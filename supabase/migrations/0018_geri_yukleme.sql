-- 0018 — Yedekten geri yükleme
--
-- 0012 yedek ALMAYI getirdi; geri yüklemeyi bilerek ertelemiştim, çünkü ~19
-- tablo arasında kimlik eşlemesi hataya açık ve o sırada test edilecek gerçek
-- veri yoktu. Geri yüklenemeyen yedek yedek sayılmaz; bu eksik kapanıyor.
--
-- TEMEL KARAR: GERİ YÜKLEME HİÇBİR ŞEYİN ÜZERİNE YAZMAZ.
-- Her zaman YENİ bir hane kurar. Mevcut haneye birleştirme yok, silme yok.
-- Yanlış dosya seçmenin bedeli fazladan bir hane; veri kaybı değil.
--
-- KİMLİK EŞLEME: yedekteki her satır yeni bir uuid alır, bağlantılar bu
-- eşlemeden çözülür. Kategoriler kendine referans verdiği için iki geçiş:
-- önce düz, sonra üst kayıt.
--
-- SÜTUNLAR ELLE YAZILMAZ. `jsonb_populate_record` yedekteki nesneyi tablonun
-- kendi satır tipine çevirir; yalnızca kimlikler ve bağlantılar üzerine
-- yazılır. Gerekçe: 19 tablo × ~15 sütunu elle saymak, şemaya sonradan
-- eklenen bir sütunun sessizce yedeğe girip geri gelmemesi demekti.
--
-- ÜYELER: başkalarının auth hesapları geri getirilemez. Çağıran kendi üyesine
-- bağlanır; diğerleri HESAPSIZ üye satırı olur (ad, avatar, rol, doğum günü
-- korunur) ve sonra katılım koduyla kendi hesaplarını bağlarlar.
--
-- KUR: yedekteki `amount_base` / `fx_rate` AYNEN korunur. Tetikleyici normalde
-- INSERT'te yeniden hesaplar ve o tarihte kur yoksa hata verir — eski bir yedek
-- bu yüzden hiç yüklenemezdi. Geri yükleme sırasında oturum bayrağı açılır.
--
-- GERİ YÜKLENMEYENLER (bilerek): dosya/fiş yolları (Storage yedeğe girmiyor,
-- yol saklanırsa kırık bağ olurdu), bildirimler ve işlem günlüğü (geçici),
-- katılım kodu hakkı (eski kod canlanmasın diye sıfırlanır).

-- ---------------------------------------------------------------------------
-- 1. Tetikleyicilere geri yükleme istisnası
-- ---------------------------------------------------------------------------
-- Bayrak `set local` ile yalnızca geri yükleme işlemi boyunca açıktır ve
-- yalnızca import_household içinden açılır; istemci PostgREST üzerinden
-- rastgele oturum değişkeni ayarlayamaz.
create or replace function public.is_restoring()
returns boolean language sql stable set search_path = public as $$
  select coalesce(current_setting('yuva.restoring', true), '') = 'on';
$$;

create or replace function public.transactions_compute_base()
returns trigger language plpgsql security definer set search_path = public as $$
declare base_ccy char(3); r numeric;
begin
  if public.is_restoring() and new.amount_base is not null and new.fx_rate is not null then
    return new;   -- yedekteki dondurulmuş kur (0018)
  end if;
  select base_currency into base_ccy from public.households where id = new.household_id;
  if tg_op = 'UPDATE'
     and new.amount = old.amount and new.currency = old.currency
     and new.occurred_on = old.occurred_on then
    new.fx_rate := old.fx_rate; new.amount_base := old.amount_base;
    return new;
  end if;
  r := public.fx_lookup(new.currency, base_ccy, new.occurred_on);
  if r is null then
    raise exception 'fx_rates: % → % için % tarihinde kur yok', new.currency, base_ccy, new.occurred_on;
  end if;
  new.fx_rate := r;
  new.amount_base := round(new.amount * r, 2);
  return new;
end $$;

create or replace function public.goal_contributions_compute_base()
returns trigger language plpgsql security definer set search_path = public as $$
declare base_ccy char(3); r numeric;
begin
  if public.is_restoring() and new.amount_base is not null and new.fx_rate is not null then
    return new;
  end if;
  select base_currency into base_ccy from public.households where id = new.household_id;
  if tg_op = 'UPDATE'
     and new.amount = old.amount and new.currency = old.currency
     and new.on_date = old.on_date and old.amount_base is not null then
    new.fx_rate := old.fx_rate; new.amount_base := old.amount_base;
    return new;
  end if;
  r := public.fx_lookup(new.currency, base_ccy, new.on_date);
  if r is null then
    raise exception 'fx_rates: % → % için % tarihinde kur yok', new.currency, base_ccy, new.on_date;
  end if;
  new.fx_rate := r;
  new.amount_base := round(new.amount * r, 2);
  return new;
end $$;

-- ---------------------------------------------------------------------------
-- 2. Geri yükleme
-- ---------------------------------------------------------------------------
-- search_path'e `extensions` eklendi: pgcrypto (gen_random_bytes) orada duruyor,
-- yalnızca `public` ile fonksiyon çalışma anında "does not exist" hatası veriyor.
create or replace function public.import_household(p_backup jsonb)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  v_uid uuid := auth.uid();
  v_hid uuid; v_me uuid; v_new uuid;
  r jsonb;
  m_member   jsonb := '{}'::jsonb;
  m_category jsonb := '{}'::jsonb;
  m_account  jsonb := '{}'::jsonb;
  m_plan     jsonb := '{}'::jsonb;
  m_event    jsonb := '{}'::jsonb;
  m_rule     jsonb := '{}'::jsonb;
  m_txn      jsonb := '{}'::jsonb;
  m_task     jsonb := '{}'::jsonb;
  m_list     jsonb := '{}'::jsonb;
begin
  if v_uid is null then raise exception 'oturum yok'; end if;
  if p_backup->>'format' is distinct from 'yuva-backup-1' then
    raise exception 'tanınmayan yedek biçimi: %', coalesce(p_backup->>'format', '(yok)');
  end if;
  if jsonb_typeof(p_backup->'household') is distinct from 'object' then
    raise exception 'yedekte hane kaydı yok';
  end if;

  perform set_config('yuva.restoring', 'on', true);   -- true = set local

  -- --- hane -----------------------------------------------------------------
  -- join_code yeni: yedekteki kod aynı projede zaten kullanımda olabilir
  -- (tekil kısıt) ve eski bir kodun canlanması istenmez.
  v_hid := gen_random_uuid();
  insert into public.households select * from jsonb_populate_record(null::public.households,
    (p_backup->'household') || jsonb_build_object(
      'id', v_hid,
      'name', (p_backup->'household'->>'name') || ' (geri yüklendi)',
      'join_code', upper(substr(encode(gen_random_bytes(6),'hex'), 1, 8)),
      'join_code_uses_left', 0,
      'join_code_expires_at', null,
      'created_by', v_uid));

  -- --- üyeler ---------------------------------------------------------------
  for r in select * from jsonb_array_elements(coalesce(p_backup->'members', '[]'::jsonb)) loop
    v_new := gen_random_uuid();
    insert into public.household_members select * from jsonb_populate_record(null::public.household_members,
      r || jsonb_build_object('id', v_new, 'household_id', v_hid,
        'user_id', case when (r->>'user_id')::uuid = v_uid then v_uid::text else null end));
    m_member := m_member || jsonb_build_object(r->>'id', v_new);
    if (r->>'user_id')::uuid = v_uid then v_me := v_new; end if;
  end loop;

  -- Yedekte çağıran yoksa (başkasının yedeği ya da hesap değişmiş) yetişkin
  -- olarak eklenir; yoksa geri yüklediği haneye kendisi giremezdi.
  if v_me is null then
    insert into public.household_members (household_id, user_id, display_name, role)
    values (v_hid, v_uid, coalesce((select full_name from public.profiles where user_id = v_uid), 'Ben'), 'adult')
    returning id into v_me;
  end if;

  -- --- kategoriler (iki geçiş) ----------------------------------------------
  for r in select * from jsonb_array_elements(coalesce(p_backup->'categories', '[]'::jsonb)) loop
    v_new := gen_random_uuid();
    insert into public.categories select * from jsonb_populate_record(null::public.categories,
      r || jsonb_build_object('id', v_new, 'household_id', v_hid, 'parent_id', null));
    m_category := m_category || jsonb_build_object(r->>'id', v_new);
  end loop;
  for r in select * from jsonb_array_elements(coalesce(p_backup->'categories', '[]'::jsonb)) loop
    if r->>'parent_id' is not null and m_category ? (r->>'parent_id') then
      update public.categories set parent_id = (m_category->>(r->>'parent_id'))::uuid
       where id = (m_category->>(r->>'id'))::uuid;
    end if;
  end loop;

  -- --- hesaplar -------------------------------------------------------------
  for r in select * from jsonb_array_elements(coalesce(p_backup->'accounts', '[]'::jsonb)) loop
    v_new := gen_random_uuid();
    insert into public.accounts select * from jsonb_populate_record(null::public.accounts,
      r || jsonb_build_object('id', v_new, 'household_id', v_hid,
        'owner_member_id', m_member->(r->>'owner_member_id')));
    m_account := m_account || jsonb_build_object(r->>'id', v_new);
  end loop;

  -- --- planlar --------------------------------------------------------------
  for r in select * from jsonb_array_elements(coalesce(p_backup->'plans', '[]'::jsonb)) loop
    v_new := gen_random_uuid();
    insert into public.plans select * from jsonb_populate_record(null::public.plans,
      r || jsonb_build_object('id', v_new, 'household_id', v_hid, 'created_by', null,
        'target_account_id', m_account->(r->>'target_account_id')));
    m_plan := m_plan || jsonb_build_object(r->>'id', v_new);
  end loop;

  for r in select * from jsonb_array_elements(coalesce(p_backup->'plan_items', '[]'::jsonb)) loop
    continue when not (m_plan ? (r->>'plan_id'));
    insert into public.plan_items select * from jsonb_populate_record(null::public.plan_items,
      r || jsonb_build_object('id', gen_random_uuid(), 'household_id', v_hid,
        'plan_id', m_plan->(r->>'plan_id'),
        'assignee_member_id', m_member->(r->>'assignee_member_id')));
  end loop;

  -- --- takvim ---------------------------------------------------------------
  for r in select * from jsonb_array_elements(coalesce(p_backup->'calendar_events', '[]'::jsonb)) loop
    v_new := gen_random_uuid();
    insert into public.calendar_events select * from jsonb_populate_record(null::public.calendar_events,
      r || jsonb_build_object('id', v_new, 'household_id', v_hid, 'created_by', null,
        'plan_id', m_plan->(r->>'plan_id')));
    m_event := m_event || jsonb_build_object(r->>'id', v_new);
  end loop;

  for r in select * from jsonb_array_elements(coalesce(p_backup->'event_attendees', '[]'::jsonb)) loop
    continue when not (m_event ? (r->>'event_id') and m_member ? (r->>'member_id'));
    insert into public.event_attendees select * from jsonb_populate_record(null::public.event_attendees,
      r || jsonb_build_object('event_id', m_event->(r->>'event_id'),
        'member_id', m_member->(r->>'member_id')))
    on conflict do nothing;
  end loop;

  -- --- para -----------------------------------------------------------------
  for r in select * from jsonb_array_elements(coalesce(p_backup->'recurring_rules', '[]'::jsonb)) loop
    v_new := gen_random_uuid();
    insert into public.recurring_rules select * from jsonb_populate_record(null::public.recurring_rules,
      r || jsonb_build_object('id', v_new, 'household_id', v_hid,
        'account_id', m_account->(r->>'account_id'),
        'category_id', m_category->(r->>'category_id')));
    m_rule := m_rule || jsonb_build_object(r->>'id', v_new);
  end loop;

  for r in select * from jsonb_array_elements(coalesce(p_backup->'transactions', '[]'::jsonb)) loop
    v_new := gen_random_uuid();
    insert into public.transactions select * from jsonb_populate_record(null::public.transactions,
      r || jsonb_build_object('id', v_new, 'household_id', v_hid, 'created_by', null,
        'receipt_path', null,                       -- Storage yedeğe girmiyor
        'account_id', m_account->(r->>'account_id'),
        'transfer_account_id', m_account->(r->>'transfer_account_id'),
        'category_id', m_category->(r->>'category_id'),
        'paid_by_member_id', m_member->(r->>'paid_by_member_id'),
        'for_member_id', m_member->(r->>'for_member_id'),
        'plan_id', m_plan->(r->>'plan_id'),
        'event_id', m_event->(r->>'event_id'),
        'recurring_id', m_rule->(r->>'recurring_id')));
    m_txn := m_txn || jsonb_build_object(r->>'id', v_new);
  end loop;

  for r in select * from jsonb_array_elements(coalesce(p_backup->'budgets', '[]'::jsonb)) loop
    insert into public.budgets select * from jsonb_populate_record(null::public.budgets,
      r || jsonb_build_object('id', gen_random_uuid(), 'household_id', v_hid,
        'category_id', m_category->(r->>'category_id')))
    on conflict do nothing;
  end loop;

  for r in select * from jsonb_array_elements(coalesce(p_backup->'goal_contributions', '[]'::jsonb)) loop
    continue when not (m_plan ? (r->>'plan_id'));
    insert into public.goal_contributions select * from jsonb_populate_record(null::public.goal_contributions,
      r || jsonb_build_object('id', gen_random_uuid(), 'household_id', v_hid,
        'plan_id', m_plan->(r->>'plan_id'),
        'transaction_id', m_txn->(r->>'transaction_id')));
  end loop;

  -- --- aile -----------------------------------------------------------------
  for r in select * from jsonb_array_elements(coalesce(p_backup->'occasions', '[]'::jsonb)) loop
    insert into public.occasions select * from jsonb_populate_record(null::public.occasions,
      r || jsonb_build_object('id', gen_random_uuid(), 'household_id', v_hid,
        'member_id', m_member->(r->>'member_id')));
  end loop;

  for r in select * from jsonb_array_elements(coalesce(p_backup->'documents', '[]'::jsonb)) loop
    insert into public.documents select * from jsonb_populate_record(null::public.documents,
      r || jsonb_build_object('id', gen_random_uuid(), 'household_id', v_hid,
        'file_path', null, 'member_id', m_member->(r->>'member_id')));
  end loop;

  for r in select * from jsonb_array_elements(coalesce(p_backup->'contacts', '[]'::jsonb)) loop
    insert into public.contacts select * from jsonb_populate_record(null::public.contacts,
      r || jsonb_build_object('id', gen_random_uuid(), 'household_id', v_hid));
  end loop;

  for r in select * from jsonb_array_elements(coalesce(p_backup->'tasks', '[]'::jsonb)) loop
    v_new := gen_random_uuid();
    insert into public.tasks select * from jsonb_populate_record(null::public.tasks,
      r || jsonb_build_object('id', v_new, 'household_id', v_hid, 'created_by', null,
        'assignee_member_id', m_member->(r->>'assignee_member_id'),
        'plan_id', m_plan->(r->>'plan_id'),
        'event_id', m_event->(r->>'event_id')));
    m_task := m_task || jsonb_build_object(r->>'id', v_new);
  end loop;

  for r in select * from jsonb_array_elements(coalesce(p_backup->'task_completions', '[]'::jsonb)) loop
    continue when not (m_task ? (r->>'task_id'));
    insert into public.task_completions select * from jsonb_populate_record(null::public.task_completions,
      r || jsonb_build_object('id', gen_random_uuid(), 'household_id', v_hid,
        'task_id', m_task->(r->>'task_id'),
        'member_id', m_member->(r->>'member_id')));
  end loop;

  -- --- alışveriş ------------------------------------------------------------
  for r in select * from jsonb_array_elements(coalesce(p_backup->'shopping_lists', '[]'::jsonb)) loop
    v_new := gen_random_uuid();
    insert into public.shopping_lists select * from jsonb_populate_record(null::public.shopping_lists,
      r || jsonb_build_object('id', v_new, 'household_id', v_hid));
    m_list := m_list || jsonb_build_object(r->>'id', v_new);
  end loop;

  for r in select * from jsonb_array_elements(coalesce(p_backup->'shopping_items', '[]'::jsonb)) loop
    continue when not (m_list ? (r->>'list_id'));
    insert into public.shopping_items select * from jsonb_populate_record(null::public.shopping_items,
      r || jsonb_build_object('id', gen_random_uuid(), 'household_id', v_hid,
        'list_id', m_list->(r->>'list_id'),
        'added_by_member_id', m_member->(r->>'added_by_member_id')));
  end loop;

  -- --- açılışta bu hane gelsin ----------------------------------------------
  update public.profiles set default_household_id = v_hid where user_id = v_uid;

  return jsonb_build_object(
    'household_id', v_hid,
    'members',      (select count(*) from public.household_members where household_id = v_hid),
    'categories',   (select count(*) from public.categories where household_id = v_hid),
    'accounts',     (select count(*) from public.accounts where household_id = v_hid),
    'transactions', (select count(*) from public.transactions where household_id = v_hid),
    'events',       (select count(*) from public.calendar_events where household_id = v_hid),
    'tasks',        (select count(*) from public.tasks where household_id = v_hid),
    'plans',        (select count(*) from public.plans where household_id = v_hid),
    'documents',    (select count(*) from public.documents where household_id = v_hid),
    'shopping_items', (select count(*) from public.shopping_items where household_id = v_hid));
end $$;

-- ---------------------------------------------------------------------------
-- 3. Hane değiştirme
-- ---------------------------------------------------------------------------
-- Geri yükleme yeni hane kurduğu için kullanıcının birden fazla hanesi olabilir;
-- açılışta hangisinin geleceği `profiles.default_household_id` ile seçilir.
-- Bu olmadan geri yükleme tek yönlü bir kapı olurdu: eski haneye dönüş yok.
create or replace function public.set_default_household(hid uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_household_member(hid) then raise exception 'yetki yok'; end if;
  update public.profiles set default_household_id = hid where user_id = auth.uid();
end $$;

create or replace function public.my_households()
returns table (id uuid, name text, base_currency char(3), is_default boolean, members bigint)
language sql stable security definer set search_path = public as $$
  select h.id, h.name, h.base_currency,
         (h.id = p.default_household_id) as is_default,
         (select count(*) from public.household_members x
           where x.household_id = h.id and x.is_active) as members
    from public.households h
    join public.household_members hm on hm.household_id = h.id and hm.is_active
    left join public.profiles p on p.user_id = auth.uid()
   where hm.user_id = auth.uid()
   order by h.created_at;
$$;

revoke all on function public.import_household(jsonb) from public;
revoke all on function public.set_default_household(uuid) from public;
revoke all on function public.my_households() from public;
grant execute on function public.import_household(jsonb) to authenticated;
grant execute on function public.set_default_household(uuid) to authenticated;
grant execute on function public.my_households() to authenticated;


-- ---------------------------------------------------------------------------
-- 4. 0015 hatası: katılım kodu yenileme çalışmıyordu
-- ---------------------------------------------------------------------------
-- Yukarıdaki sorunun aynısı: `rotate_join_code` da gen_random_bytes çağırıyor
-- ama search_path yalnızca `public` idi. Ayarlar'daki "Yeni kod üret" düğmesi
-- her seferinde hata veriyordu; geri yüklemeyi denerken ortaya çıktı.
create or replace function public.rotate_join_code(
  hid uuid, p_role member_role default 'adult',
  p_hours int default 168, p_uses int default 1)
returns text language plpgsql security definer set search_path = public, extensions as $$
declare v_code text;
begin
  if not public.is_household_adult(hid) then raise exception 'yetki yok'; end if;
  if p_uses < 1 or p_uses > 10 then raise exception 'kullanım hakkı 1-10 arası olmalı'; end if;
  if p_hours < 1 or p_hours > 720 then raise exception 'süre 1-720 saat arası olmalı'; end if;

  v_code := upper(substr(encode(gen_random_bytes(6),'hex'),1,8));
  update public.households
     set join_code = v_code,
         join_code_role = p_role,
         join_code_uses_left = p_uses,
         join_code_expires_at = now() + make_interval(hours => p_hours),
         updated_at = now()
   where id = hid;
  return v_code;
end $$;

revoke all on function public.rotate_join_code(uuid, member_role, int, int) from public;
grant execute on function public.rotate_join_code(uuid, member_role, int, int) to authenticated;
