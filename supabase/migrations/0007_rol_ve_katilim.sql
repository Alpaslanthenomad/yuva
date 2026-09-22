-- 0007 — Rol/gizlilik ve katılım kodu sertleştirmesi
-- Bulgular (2026-09-21):
--  1. PROJECT_BLUEPRINT "misafir para göremez" diyor; 0001'deki genel RLS şablonu
--     ise accounts/transactions/budgets/recurring_rules/goal_contributions için
--     okumayı TÜM üyelere açıyordu. Ayrıca month_summary, budget_status,
--     today_snapshot ve app_bootstrap `security definer` olduğu için RLS'i atlayıp
--     misafire para verisi döndürüyordu; app_bootstrap hesapları ve katılım kodunu
--     da herkese açıyordu.
--  2. Katılım kodunun süresi, kullanım sınırı ve hangi rolle girileceği yoktu;
--     kodu bilen herkes onay beklemeden YETİŞKİN olarak haneye katılabiliyordu.
-- Migration idempotenttir.

-- ---------------------------------------------------------------------------
-- 1. Para görme yetkisi tek yerde
-- ---------------------------------------------------------------------------
-- Ayrı fonksiyon: ileride 'teen' gibi bir rol eklenirse kural tek noktadan değişir.
create or replace function public.can_see_money(hid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.household_members m
    where m.household_id = hid and m.user_id = auth.uid()
      and m.is_active and m.role = 'adult'
  );
$$;

-- ---------------------------------------------------------------------------
-- 2. Finansal tablolarda okuma yalnızca yetişkine
-- ---------------------------------------------------------------------------
-- 0001'deki `<tablo>_read` politikaları üyeye açıktı. Politikalar OR'lanır,
-- bu yüzden eskisini bırakmak yetmez; düşürüp yeniden kuruyoruz.
do $$
declare t text;
begin
  foreach t in array array[
    'accounts','transactions','budgets','recurring_rules','goal_contributions'
  ] loop
    execute format('drop policy if exists %s_read on public.%I', t, t);
    execute format('create policy %s_read on public.%I for select
                    using (public.can_see_money(household_id))', t, t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 3. security definer RPC'ler de aynı sınırı uygular
-- ---------------------------------------------------------------------------
create or replace function public.month_summary(hid uuid, p_period char(7))
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare d1 date; d2 date; v_expense numeric; v_income numeric; v_fixed numeric; res jsonb;
begin
  if not public.can_see_money(hid) then raise exception 'yetki yok'; end if;
  d1 := to_date(p_period || '-01', 'YYYY-MM-DD');
  d2 := (d1 + interval '1 month')::date;

  select coalesce(sum(amount_base) filter (where kind = 'expense'), 0),
         coalesce(sum(amount_base) filter (where kind = 'income'), 0)
    into v_expense, v_income
    from public.transactions
   where household_id = hid and occurred_on >= d1 and occurred_on < d2;

  select coalesce(sum(t.amount_base), 0) into v_fixed
    from public.transactions t
    left join public.categories cc on cc.id = t.category_id
    left join public.categories pc on pc.id = cc.parent_id
   where t.household_id = hid and t.kind = 'expense'
     and t.occurred_on >= d1 and t.occurred_on < d2
     and (coalesce(cc.is_fixed, false) or coalesce(pc.is_fixed, false));

  res := jsonb_build_object(
    'period', p_period,
    'expense', v_expense,
    'income', v_income,
    'fixed', v_fixed,
    'variable', v_expense - v_fixed,
    'by_category', (
      select coalesce(jsonb_agg(jsonb_build_object('category_id',c.id,'name',c.name,'icon',c.icon,'total',x.total)
                      order by x.total desc),'[]'::jsonb)
      from (select coalesce(pc.id, cc.id) as cid, sum(t.amount_base) total
              from public.transactions t
              left join public.categories cc on cc.id = t.category_id
              left join public.categories pc on pc.id = cc.parent_id
             where t.household_id = hid and t.kind='expense'
               and t.occurred_on >= d1 and t.occurred_on < d2
             group by 1) x
      left join public.categories c on c.id = x.cid),
    'by_member', (
      select coalesce(jsonb_agg(jsonb_build_object('member_id',m.id,'name',m.display_name,'total',x.total)),'[]'::jsonb)
      from (select for_member_id mid, sum(amount_base) total from public.transactions
             where household_id = hid and kind='expense' and occurred_on >= d1 and occurred_on < d2
             group by 1) x left join public.household_members m on m.id = x.mid)
  );
  return res;
end $$;

create or replace function public.budget_status(hid uuid, p_period char(7))
returns table (category_id uuid, category_name text, icon text, budget numeric, spent numeric, remaining numeric, pct numeric)
language sql stable security definer set search_path = public as $$
  with sp as (
    select coalesce(pc.id, cc.id) cid, sum(t.amount_base) total
      from public.transactions t
      left join public.categories cc on cc.id = t.category_id
      left join public.categories pc on pc.id = cc.parent_id
     where t.household_id = hid and t.kind = 'expense'
       and t.occurred_on >= to_date(p_period||'-01','YYYY-MM-DD')
       and t.occurred_on <  to_date(p_period||'-01','YYYY-MM-DD') + interval '1 month'
     group by 1),
  tot as (
    select coalesce(sum(t.amount_base), 0) total
      from public.transactions t
     where t.household_id = hid and t.kind = 'expense'
       and t.occurred_on >= to_date(p_period||'-01','YYYY-MM-DD')
       and t.occurred_on <  to_date(p_period||'-01','YYYY-MM-DD') + interval '1 month')
  select b.category_id, c.name, c.icon, b.amount_base,
         s.spent,
         b.amount_base - s.spent,
         case when b.amount_base > 0 then round(100 * s.spent / b.amount_base, 1) else 0 end
    from public.budgets b
    left join public.categories c on c.id = b.category_id
    cross join lateral (
      select case when b.category_id is null
                  then (select total from tot)
                  else coalesce((select sp.total from sp where sp.cid = b.category_id), 0)
             end as spent
    ) s
   where b.household_id = hid and b.period = p_period
     and public.can_see_money(hid)
   order by (b.category_id is not null), 7 desc;
$$;

-- Bugün ekranı: misafirde para bölümleri boş döner, ekran çökmez.
create or replace function public.today_snapshot(
  hid uuid,
  p_from date default current_date,
  p_days int default 7,
  p_period char(7) default to_char(current_date, 'YYYY-MM')
)
returns jsonb language plpgsql security definer set search_path = public stable as $$
declare v_money boolean;
begin
  if not public.is_household_member(hid) then raise exception 'yetkisiz'; end if;
  v_money := public.can_see_money(hid);

  return jsonb_build_object(
    'agenda', public.upcoming_agenda(hid, p_from, p_days),
    'month', case when v_money
                  then to_jsonb(public.month_summary(hid, p_period))
                  else jsonb_build_object('period', p_period, 'expense', 0, 'income', 0,
                                          'fixed', 0, 'variable', 0,
                                          'by_category', '[]'::jsonb, 'by_member', '[]'::jsonb) end,
    'budget', case when v_money
                   then coalesce((select jsonb_agg(to_jsonb(b)) from public.budget_status(hid, p_period) b), '[]'::jsonb)
                   else '[]'::jsonb end,
    'shopping', coalesce((
      select jsonb_agg(to_jsonb(s) order by s.created_at)
      from public.shopping_items s
      where s.household_id = hid), '[]'::jsonb),
    'notifications', coalesce((
      select jsonb_agg(to_jsonb(n) order by n.fire_at desc)
      from public.notifications n
      where n.household_id = hid and n.read_at is null), '[]'::jsonb)
  );
end $$;

-- ---------------------------------------------------------------------------
-- 4. Katılım kodu: süre, kullanım hakkı, rol
-- ---------------------------------------------------------------------------
alter table public.households add column if not exists join_code_expires_at timestamptz;
alter table public.households add column if not exists join_code_uses_left int not null default 0;
alter table public.households add column if not exists join_code_role member_role not null default 'guest';

-- Mevcut haneler: kod bir kez, 30 gün, yetişkin olarak kullanılabilsin
-- (eşin henüz katılmadı — açık bırakıyoruz, ama artık sınırlı).
update public.households
   set join_code_uses_left = 1,
       join_code_expires_at = coalesce(join_code_expires_at, now() + interval '30 days'),
       join_code_role = 'adult'
 where join_code_expires_at is null and join_code_uses_left = 0;

create or replace function public.join_household(p_code text, p_display_name text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare hid uuid; nm text; v_role member_role;
begin
  if auth.uid() is null then raise exception 'giriş gerekli'; end if;

  select id, join_code_role into hid, v_role
    from public.households
   where join_code = upper(trim(p_code))
     and join_code_uses_left > 0
     and (join_code_expires_at is null or join_code_expires_at > now())
   for update;

  if hid is null then raise exception 'kod geçersiz veya süresi dolmuş'; end if;

  select coalesce(p_display_name, full_name, 'Üye') into nm
    from public.profiles where user_id = auth.uid();

  -- Zaten üyeyse hakkı harcama, yalnızca tekrar etkinleştir.
  if exists (select 1 from public.household_members
              where household_id = hid and user_id = auth.uid()) then
    update public.household_members set is_active = true
     where household_id = hid and user_id = auth.uid();
  else
    insert into public.household_members (household_id, user_id, display_name, role)
      values (hid, auth.uid(), nm, v_role);
    update public.households
       set join_code_uses_left = join_code_uses_left - 1
     where id = hid;
  end if;

  update public.profiles set default_household_id = coalesce(default_household_id, hid)
    where user_id = auth.uid();
  return hid;
end $$;

-- Yeni hane: kod bir kez, 7 gün, yetişkin (eşi davet etmek için).
create or replace function public.create_household(
  p_name text, p_base_currency char(3) default 'CLP',
  p_timezone text default 'America/Santiago', p_display_name text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare hid uuid; nm text;
begin
  if auth.uid() is null then raise exception 'giriş gerekli'; end if;
  insert into public.households (name, base_currency, timezone, created_by,
                                 join_code_uses_left, join_code_expires_at, join_code_role)
    values (p_name, p_base_currency, p_timezone, auth.uid(),
            1, now() + interval '7 days', 'adult')
    returning id into hid;
  select coalesce(p_display_name, full_name, 'Ben') into nm from public.profiles where user_id = auth.uid();
  insert into public.household_members (household_id, user_id, display_name, role)
    values (hid, auth.uid(), coalesce(nm,'Ben'), 'adult');
  update public.profiles set default_household_id = hid where user_id = auth.uid();
  insert into public.accounts (household_id, name, type, currency, icon)
    values (hid, 'Nakit', 'cash', p_base_currency, '💵');
  perform public.seed_default_categories(hid);
  return hid;
end $$;

-- Yeni kod üret: yalnızca yetişkin, rolü ve süreyi kendi seçer.
create or replace function public.rotate_join_code(
  hid uuid, p_role member_role default 'adult',
  p_hours int default 168, p_uses int default 1)
returns text language plpgsql security definer set search_path = public as $$
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

-- ---------------------------------------------------------------------------
-- 5. app_bootstrap: hesaplar ve katılım kodu yalnızca yetişkine
-- ---------------------------------------------------------------------------
create or replace function public.app_bootstrap()
returns jsonb language plpgsql security definer set search_path = public stable as $$
declare
  v_uid uuid := auth.uid();
  v_hid uuid;
  v_money boolean;
  v_household jsonb;
  v_empty jsonb := jsonb_build_object('household', null, 'members', '[]'::jsonb, 'me', null);
begin
  if v_uid is null then return v_empty; end if;

  select p.default_household_id into v_hid from public.profiles p where p.user_id = v_uid;
  if v_hid is null then
    select hm.household_id into v_hid
      from public.household_members hm
     where hm.user_id = v_uid and hm.is_active
     order by hm.created_at limit 1;
  end if;
  if v_hid is null then return v_empty; end if;

  if not exists (
    select 1 from public.household_members hm
    where hm.household_id = v_hid and hm.user_id = v_uid and hm.is_active
  ) then
    return v_empty;
  end if;

  v_money := public.can_see_money(v_hid);

  select to_jsonb(h) into v_household from public.households h where h.id = v_hid;
  -- Katılım kodu davet yetkisidir: yalnızca yetişkin görür.
  if not v_money then
    v_household := v_household - 'join_code' - 'join_code_expires_at'
                               - 'join_code_uses_left' - 'join_code_role';
  end if;

  return jsonb_build_object(
    'household', v_household,
    'members', coalesce((
      select jsonb_agg(to_jsonb(m) order by m.created_at)
      from public.household_members m
      where m.household_id = v_hid and m.is_active), '[]'::jsonb),
    'me', (
      select to_jsonb(m) from public.household_members m
      where m.household_id = v_hid and m.user_id = v_uid and m.is_active
      limit 1),
    'accounts', case when v_money then coalesce((
      select jsonb_agg(to_jsonb(a) order by a.sort_order)
      from public.accounts a
      where a.household_id = v_hid and not a.is_archived), '[]'::jsonb) else '[]'::jsonb end,
    'categories', coalesce((
      select jsonb_agg(to_jsonb(c) order by c.sort_order)
      from public.categories c
      where c.household_id = v_hid), '[]'::jsonb),
    'rates', coalesce((
      select jsonb_agg(to_jsonb(r))
      from (
        select distinct on (f.base, f.quote) f.base, f.quote, f.rate
        from public.fx_rates f
        order by f.base, f.quote, f.rate_date desc
      ) r), '[]'::jsonb)
  );
end $$;

-- ---------------------------------------------------------------------------
-- 6. Yetkiler (0003 kuralı: varsayılan kapalı, yalnızca girişli kullanıcıya açık)
-- ---------------------------------------------------------------------------
revoke all on function public.can_see_money(uuid) from public;
revoke all on function public.rotate_join_code(uuid, member_role, int, int) from public;
grant execute on function public.can_see_money(uuid) to authenticated;
grant execute on function public.rotate_join_code(uuid, member_role, int, int) to authenticated;
