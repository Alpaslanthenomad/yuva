-- 0033 — Düzenli ödemeler: vade bildirimi ve tek dokunuşla "Ödendi"
--
-- İSTEK: "Kira, okul, sağlık sigortası gibi ödemeler için vadeden bir gün
-- önce bildirim gelsin ve 'Ödendi' diye tek dokunuşla işaretlenebilsin."
--
-- DEĞİŞENLER:
--   • Otomatik YAZILMAYAN bir ödemenin vadesi artık kendiliğinden ileri
--     kaymıyor. Eskiden vade günü bir bildirim düşüp tarih bir sonraki aya
--     atlıyordu; ödeyip ödemediğin hiçbir yerde görünmüyordu. Şimdi ödeme
--     "Ödendi" (harcama yazılır, vade ilerler) ya da "Bu sefer atla" (vade
--     ilerler, harcama yok) denene kadar bekliyor ve ekranda gecikmiş görünüyor.
--   • Otomatik yazılanlar eskisi gibi vade günü harcamaya dönüşüyor.
--   • Bildirim: reminder_days gün önce saat 09:00'da "💳 Kira · 1 gün sonra";
--     otomatik olmayanlarda vade günü 09:00'da "💳 Kira · bugün". Dokununca
--     Bütçe → Hesaplar açılır ve o ödemenin "Ödendi" onayı hazır gelir.
--   • Yalnızca parayı görebilen yetişkinlere; Ayarlar'dan kapatılabilir
--     (notify_prefs.bills).

alter table public.notify_prefs add column if not exists bills boolean not null default true;

-- Günlük iş: otomatik olanları yaz, diğerlerinde yalnızca vade gününün
-- uygulama içi bildirimini bırak (telefona bildirim zamanlayıcıdan gidiyor).
create or replace function public.post_due_recurring()
returns int language plpgsql security definer set search_path = public as $$
declare r record; n int := 0; cur date; guard int;
begin
  for r in select * from public.recurring_rules
            where is_active and next_due_on <= current_date loop
    if r.auto_post and r.account_id is not null then
      cur := r.next_due_on; guard := 0;
      while cur <= current_date and guard < 240 loop
        guard := guard + 1;
        insert into public.transactions (household_id, kind, account_id, amount, currency,
                                         occurred_on, category_id, merchant, recurring_id, note)
        values (r.household_id, r.kind, r.account_id, r.amount, r.currency,
                cur, r.category_id, r.name, r.id, 'otomatik');
        n := n + 1;
        cur := public.recurring_next(r.rrule, cur);
      end loop;
      update public.recurring_rules set next_due_on = cur, updated_at = now() where id = r.id;
    elsif r.next_due_on = current_date then
      insert into public.notifications (household_id, title, body, kind, entity_type, entity_id)
      values (r.household_id, r.name || ' vadesi geldi',
              public.para_yaz(r.amount, r.currency), 'bill_due', 'recurring_rules', r.id);
    end if;
  end loop;
  return n;
end $$;
revoke all on function public.post_due_recurring() from public, anon, authenticated;

-- Vade bildirimini zamanlayıcı gönderiyor; uygulama içi kayıt ikinci kez itmesin.
create or replace function public.notifications_to_push()
returns trigger language plpgsql security definer set search_path = public as $$
declare m record;
begin
  if new.kind = 'bill_due' then return new; end if;
  for m in
    select hm.id from public.household_members hm
      left join public.notify_prefs p on p.member_id = hm.id
     where hm.household_id = new.household_id and hm.is_active and hm.user_id is not null
       and (new.member_id is null or hm.id = new.member_id)
       and coalesce(p.digest, true)
  loop
    perform public.push_enqueue(m.id, new.title, new.body, '/', 'nt-' || new.kind,
                                'nt:' || new.id, greatest(new.fire_at, now() - interval '1 minute'));
  end loop;
  return new;
end $$;

-- Ödendi: harcamayı yaz, vadeyi bir sonraki döneme taşı. Tek işlem.
create or replace function public.bill_pay(hid uuid, p_rule uuid, p_date date default null,
                                           p_amount numeric default null, p_account uuid default null)
returns public.transactions language plpgsql security definer set search_path = public as $$
declare r public.recurring_rules; acc uuid; t public.transactions;
begin
  if not public.is_household_adult(hid) then raise exception 'yetki yok'; end if;
  select * into r from public.recurring_rules where id = p_rule and household_id = hid and is_active;
  if r.id is null then raise exception 'ödeme bulunamadı'; end if;
  acc := coalesce(p_account, r.account_id,
                  (select id from public.accounts where household_id = hid and not is_archived order by created_at limit 1));
  if acc is null then raise exception 'hesap yok'; end if;
  insert into public.transactions (household_id, kind, account_id, amount, currency, occurred_on,
                                   category_id, merchant, recurring_id, paid_by_member_id, created_by)
  values (hid, r.kind, acc, coalesce(p_amount, r.amount), r.currency, coalesce(p_date, current_date),
          r.category_id, r.name, r.id, public.my_member_id(hid), auth.uid())
  returning * into t;
  update public.recurring_rules set next_due_on = public.recurring_next(r.rrule, r.next_due_on), updated_at = now()
   where id = r.id;
  return t;
end $$;

-- Bu sefer atla: harcama yok, vade ilerler.
create or replace function public.bill_skip(hid uuid, p_rule uuid)
returns date language plpgsql security definer set search_path = public as $$
declare nxt date;
begin
  if not public.is_household_adult(hid) then raise exception 'yetki yok'; end if;
  update public.recurring_rules set next_due_on = public.recurring_next(rrule, next_due_on), updated_at = now()
   where id = p_rule and household_id = hid and is_active
  returning next_due_on into nxt;
  if nxt is null then raise exception 'ödeme bulunamadı'; end if;
  return nxt;
end $$;
revoke all on function public.bill_pay(uuid, uuid, date, numeric, uuid) from public, anon;
revoke all on function public.bill_skip(uuid, uuid) from public, anon;
grant execute on function public.bill_pay(uuid, uuid, date, numeric, uuid) to authenticated;
grant execute on function public.bill_skip(uuid, uuid) to authenticated;

create or replace function public.push_schedule_bills(p_now timestamptz default now())
returns integer language plpgsql security definer set search_path = public as $$
declare h record; m record; r record; ln timestamp; ld date; f timestamp; kalan int; n int := 0; es boolean;
begin
  for h in select id, coalesce(nullif(timezone, ''), 'America/Santiago') as tz, coalesce(locale, 'tr') as loc
             from public.households
            where exists (select 1 from public.push_subscriptions s where s.household_id = households.id)
  loop
    ln := p_now at time zone h.tz;
    ld := ln::date;
    f := ld + time '09:00';
    continue when not (f > ln - interval '20 minutes' and f <= ln);
    for m in
      select hm.id, coalesce(hm.locale, h.loc) like 'es%' as es
        from public.household_members hm
        left join public.notify_prefs p on p.member_id = hm.id
       where hm.household_id = h.id and hm.is_active and hm.user_id is not null and hm.role = 'adult'
         and coalesce(p.bills, true)
         and exists (select 1 from public.push_subscriptions s where s.member_id = hm.id)
    loop
      es := m.es;
      for r in select * from public.recurring_rules where household_id = h.id and is_active and kind = 'expense' loop
        kalan := r.next_due_on - ld;
        continue when not ((coalesce(r.reminder_days, 0) > 0 and kalan = r.reminder_days)
                           or (kalan = 0 and not r.auto_post));
        perform public.push_enqueue(m.id,
          '💳 ' || r.name || ' · ' || case
             when kalan = 0 then (case when es then 'hoy' else 'bugün' end)
             when kalan = 1 then (case when es then 'mañana' else 'yarın' end)
             else (case when es then 'en ' || kalan || ' días' else kalan || ' gün sonra' end) end,
          public.para_yaz(r.amount, r.currency) || case when r.auto_post
            then (case when es then ' · se registra solo' else ' · otomatik yazılacak' end)
            else (case when es then ' · toca para marcar como pagado' else ' · ödeyince dokun, işaretle' end) end,
          '/para/?sekme=accounts' || case when r.auto_post then '' else '&ode=' || r.id end,
          'bl-' || r.id, 'bill:' || r.id || ':' || r.next_due_on || ':' || kalan, p_now);
        n := n + 1;
      end loop;
    end loop;
  end loop;
  return n;
end $$;
revoke all on function public.push_schedule_bills(timestamptz) from public, anon, authenticated;

create or replace function public.push_tick()
returns void language plpgsql security definer set search_path = public, extensions as $$
begin
  perform public.push_schedule(now());
  perform public.push_schedule_weekly(now());
  perform public.push_schedule_occasions(now());
  perform public.push_schedule_bills(now());
  delete from public.push_outbox where created_at < now() - interval '7 days';
  if exists (select 1 from public.push_outbox
              where sent_at is null and fire_at <= now() and fire_at > now() - interval '6 hours'
                and attempts < 5 and (claimed_at is null or claimed_at < now() - interval '5 minutes')) then
    perform net.http_post(
      url := 'https://oegkmjzhrcitvuoyarlt.supabase.co/functions/v1/push-send',
      headers := jsonb_build_object('Content-Type', 'application/json',
                   'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'yuva_push_cron')),
      body := '{}'::jsonb,
      timeout_milliseconds := 20000);
  end if;
end $$;

create or replace function public.notify_prefs_get(hid uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare mid uuid; r jsonb;
begin
  mid := public.my_member_id(hid);
  if mid is null then raise exception 'yetki yok'; end if;
  select to_jsonb(p) - 'household_id' - 'member_id' - 'updated_at' into r from public.notify_prefs p where member_id = mid;
  return coalesce(r, jsonb_build_object('events', true, 'event_lead_min', 30, 'plans', true, 'blocks', true,
                     'supplements', true, 'supplements_at', '09:00', 'goals', true, 'goals_at', '20:30', 'digest', true,
                     'weekly', true, 'weekly_at', '19:00', 'occasions', true, 'bills', true))
         || jsonb_build_object('devices', (select count(*) from public.push_subscriptions where member_id = mid));
end $$;

create or replace function public.notify_prefs_set(hid uuid, p jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare mid uuid;
begin
  mid := public.my_member_id(hid);
  if mid is null then raise exception 'yetki yok'; end if;
  insert into public.notify_prefs (member_id, household_id) values (mid, hid) on conflict do nothing;
  update public.notify_prefs set
    events         = coalesce((p->>'events')::boolean, events),
    event_lead_min = coalesce((p->>'event_lead_min')::int, event_lead_min),
    plans          = coalesce((p->>'plans')::boolean, plans),
    blocks         = coalesce((p->>'blocks')::boolean, blocks),
    supplements    = coalesce((p->>'supplements')::boolean, supplements),
    supplements_at = coalesce((p->>'supplements_at')::time, supplements_at),
    goals          = coalesce((p->>'goals')::boolean, goals),
    goals_at       = coalesce((p->>'goals_at')::time, goals_at),
    digest         = coalesce((p->>'digest')::boolean, digest),
    weekly         = coalesce((p->>'weekly')::boolean, weekly),
    weekly_at      = coalesce((p->>'weekly_at')::time, weekly_at),
    occasions      = coalesce((p->>'occasions')::boolean, occasions),
    bills          = coalesce((p->>'bills')::boolean, bills),
    updated_at     = now()
  where member_id = mid;
end $$;

-- Bugün ekranı: ödenmemiş (otomatik olmayan) gecikmiş ödemeler de "Bekleyen"de
-- görünsün; artık vadeleri kendiliğinden ilerlemiyor. upcoming_agenda'nın
-- yalnızca bu koşulu değişiyor, geri kalanı olduğu gibi kalsın diye yerinde
-- değiştiriliyor (tekrar çalıştırılırsa bir şey yapmaz).
do $$
declare d text;
begin
  d := pg_get_functiondef('public.upcoming_agenda'::regproc);
  if position('r.next_due_on between p_from and p_to' in d) > 0 then
    d := replace(d, 'r.next_due_on between p_from and p_to',
                    'r.next_due_on <= p_to and (r.next_due_on >= p_from or not r.auto_post)');
    execute d;
  end if;
end $$;
