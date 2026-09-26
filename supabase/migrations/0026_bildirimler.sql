-- 0026 — Telefona bildirim (Web Push): etkinlik, plan ve günlük düzen
--
-- İSTEK: "yaklaşan etkinlikler için ve günlük yapılması gereken alışkanlıklar
-- için hatırlatma ve bildirim özelliklerini aktive etmelisin."
--
-- NASIL ÇALIŞIYOR
--   1. Telefon izin verince tarayıcı bir abonelik (adres + iki anahtar) üretir;
--      push_subscribe() onu kişiye bağlı saklar.
--   2. pg_cron her dakika push_tick() çalıştırır. push_schedule() o dakika
--      zamanı gelen hatırlatmaları hesaplayıp push_outbox'a yazar. Her
--      hatırlatmanın tekil bir anahtarı var: aynı şey iki kez gitmez.
--   3. Kuyrukta gönderilecek varsa push_tick() 'push-send' fonksiyonunu
--      (Edge Function) çağırır; o da VAPID ile imzalayıp gönderir, sonucu
--      push_report() ile yazar. Ölmüş abonelik (404/410) silinir.
--   4. Uygulamadaki mevcut bildirimler (sabah özeti, vade, belge) da
--      notifications tablosuna yazıldığı an kuyruğa düşer — ayrı bir hat yok.
--
-- NE ZAMAN HATIRLATILIR (tercihler kişiye özel, notify_prefs)
--   • Olay: başlamadan N dakika önce (olayda ayar yoksa kişinin varsayılanı,
--     başlangıçta 30 dk). Tüm gün olaylar sabah 08:00'de; "1 gün önce"
--     seçildiyse bir önceki akşam 20:00'de.
--   • Plan: bir gün önce akşam 20:00; saat girildiyse başlamadan 2 saat önce,
--     girilmediyse o sabah 08:00.
--   • Günlük düzen blokları: başladığı dakika (blokta bildirim kapatılabilir).
--   • Takviye: kişinin seçtiği saatte, o gün alınmamış olan varsa.
--   • Günlük hedefler: kişinin seçtiği akşam saatinde, tamamlanmamış varsa.
--   Saatler hanenin saat diliminde (households.timezone) hesaplanır.
--
-- TEKRARLAYAN OLAYLAR: tekrar açma normalde ön yüzde yapılıyor (ARCHITECTURE).
-- Sunucunun hatırlatma gönderebilmesi için "bu olay şu gün var mı?" sorusunu
-- burada da yanıtlamak gerekiyor. rrule_occurs() yalnızca uygulamanın ürettiği
-- kuralları (DAILY / WEEKLY+BYDAY / MONTHLY+BYMONTHDAY / YEARLY, INTERVAL,
-- UNTIL) biliyor; COUNT yok sayılıyor. Canlı veritabanında lib/dates.js
-- expandRRule ile 30 kural×başlangıç için 420 gün boyunca karşılaştırıldı:
-- uygulamanın ürettiği bütün kurallarda birebir aynı. Tek fark, uygulamanın
-- hiç üretmediği bir biçimde (başlangıç 21'i iken BYMONTHDAY=-1/31): ön yüz
-- o ayın son gününü atlıyor, burası atlamıyor.
--
-- GİZLİ ANAHTARLAR (VAPID özel anahtarı, cron sırrı) BU DOSYADA YOK — depo
-- herkese açık. Supabase Vault'ta 'yuva_vapid_public', 'yuva_vapid_private',
-- 'yuva_push_cron' adlarıyla duruyorlar; yeni bir kurulumda bir kez
-- vault.create_secret(...) ile eklenmeleri gerekir.

create extension if not exists pg_net;

-- ---------------------------------------------------------------------------
-- Tablolar
create table if not exists public.push_subscriptions (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  member_id    uuid not null references public.household_members(id) on delete cascade,
  user_id      uuid not null default auth.uid(),
  endpoint     text not null unique,
  p256dh       text not null,
  auth         text not null,
  ua           text,
  created_at   timestamptz not null default now(),
  last_ok_at   timestamptz,
  fail_count   int not null default 0
);
create index if not exists push_subs_member on public.push_subscriptions (member_id);
alter table public.push_subscriptions enable row level security;
drop policy if exists push_subs_kendi on public.push_subscriptions;
create policy push_subs_kendi on public.push_subscriptions for select
  using (user_id = auth.uid());
-- Yazma yalnızca push_subscribe / push_unsubscribe üzerinden.

create table if not exists public.notify_prefs (
  member_id      uuid primary key references public.household_members(id) on delete cascade,
  household_id   uuid not null references public.households(id) on delete cascade,
  events         boolean not null default true,
  event_lead_min int     not null default 30 check (event_lead_min between 0 and 2880),
  plans          boolean not null default true,
  blocks         boolean not null default true,
  supplements    boolean not null default true,
  supplements_at time    not null default '09:00',
  goals          boolean not null default true,
  goals_at       time    not null default '20:30',
  digest         boolean not null default true,
  updated_at     timestamptz not null default now()
);
alter table public.notify_prefs enable row level security;
drop policy if exists notify_prefs_kendi on public.notify_prefs;
create policy notify_prefs_kendi on public.notify_prefs for select
  using (member_id in (select id from public.household_members where user_id = auth.uid() and is_active));

create table if not exists public.push_outbox (
  id           bigserial primary key,
  household_id uuid not null references public.households(id) on delete cascade,
  member_id    uuid not null references public.household_members(id) on delete cascade,
  title        text not null,
  body         text,
  url          text not null default '/',
  tag          text,
  dedupe_key   text not null,
  fire_at      timestamptz not null default now(),
  created_at   timestamptz not null default now(),
  claimed_at   timestamptz,
  sent_at      timestamptz,
  attempts     int not null default 0,
  unique (member_id, dedupe_key)
);
create index if not exists push_outbox_bekleyen on public.push_outbox (fire_at) where sent_at is null;
alter table public.push_outbox enable row level security;   -- politikası yok: yalnızca sunucu

-- ---------------------------------------------------------------------------
-- Yardımcılar
create or replace function public.rrule_occurs(p_rrule text, p_start date, p_exdates date[], p_day date)
returns boolean language plpgsql immutable set search_path = public as $$
declare freq text; itv int; until date; byday text[]; bymd int; dow text;
        ay int; hedef int; son int;
begin
  if p_day < p_start then return false; end if;
  if p_exdates is not null and p_day = any(p_exdates) then return false; end if;
  if p_rrule is null or p_rrule = '' then return p_day = p_start; end if;
  freq  := substring(p_rrule from 'FREQ=([A-Z]+)');
  itv   := coalesce(nullif(substring(p_rrule from 'INTERVAL=([0-9]+)'), '')::int, 1);
  until := case when p_rrule ~ 'UNTIL=[0-9]{8}'
                then to_date(substring(p_rrule from 'UNTIL=([0-9]{8})'), 'YYYYMMDD') end;
  if until is not null and p_day > until then return false; end if;
  byday := string_to_array(substring(p_rrule from 'BYDAY=([A-Z,]+)'), ',');
  bymd  := nullif(substring(p_rrule from 'BYMONTHDAY=(-?[0-9]+)'), '')::int;
  dow   := (array['MO','TU','WE','TH','FR','SA','SU'])[extract(isodow from p_day)::int];
  -- Başlangıç günü her zaman ilk tekrardır (ön yüzle aynı), yalnızca BYDAY
  -- o günü dışarıda bırakıyorsa değil.
  if p_day = p_start and (byday is null or dow = any(byday)) then return true; end if;

  if freq = 'DAILY' then
    return (p_day - p_start) % itv = 0;
  elsif freq = 'WEEKLY' then
    if byday is not null then
      return dow = any(byday)
        and (((p_day - (extract(isodow from p_day)::int - 1))
             - (p_start - (extract(isodow from p_start)::int - 1))) / 7) % itv = 0;
    end if;
    return (p_day - p_start) % (7 * itv) = 0;
  elsif freq = 'MONTHLY' then
    ay := ((extract(year from p_day) * 12 + extract(month from p_day))
         - (extract(year from p_start) * 12 + extract(month from p_start)))::int;
    if ay % itv <> 0 then return false; end if;
    son := extract(day from (date_trunc('month', p_day) + interval '1 month - 1 day'))::int;
    hedef := coalesce(bymd, extract(day from p_start)::int);
    if hedef = -1 then return extract(day from p_day)::int = son; end if;
    return extract(day from p_day)::int = least(hedef, son);   -- 31 → şubatta 28
  elsif freq = 'YEARLY' then
    return extract(month from p_day) = extract(month from p_start)
       and extract(day from p_day) = extract(day from p_start)
       and ((extract(year from p_day) - extract(year from p_start))::int % itv) = 0;
  end if;
  return false;
end $$;

-- Kuyruğa yaz. Kişinin aboneliği yoksa yazmaz (gönderilecek yer yok).
create or replace function public.push_enqueue(p_member uuid, p_title text, p_body text, p_url text,
                                               p_tag text, p_key text, p_fire timestamptz default now())
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.push_subscriptions where member_id = p_member) then return; end if;
  insert into public.push_outbox (household_id, member_id, title, body, url, tag, dedupe_key, fire_at)
  select hm.household_id, p_member, p_title, p_body, coalesce(p_url, '/'), p_tag, p_key, p_fire
    from public.household_members hm where hm.id = p_member
  on conflict (member_id, dedupe_key) do nothing;
end $$;

-- ---------------------------------------------------------------------------
-- Zamanlayıcı: "şu an zamanı gelen hatırlatmalar". Pencere 20 dakika geriye
-- bakıyor: cron bir iki dakika aksarsa kaçırılmasın; tekil anahtar yüzünden
-- aynı hatırlatma ikinci kez yazılmıyor.
create or replace function public.push_schedule(p_now timestamptz default now())
returns int language plpgsql security definer set search_path = public as $$
declare h record; m record; e record; b record; pl record;
        ln timestamp; lo timestamp; ld date; d date; f timestamp; occ timestamp;
        leads int[]; l int; es boolean; n int := 0; txt text;
begin
  for h in select id, coalesce(nullif(timezone, ''), 'America/Santiago') as tz, coalesce(locale, 'tr') as loc
             from public.households
            where exists (select 1 from public.push_subscriptions s where s.household_id = households.id)
  loop
    ln := p_now at time zone h.tz;
    lo := ln - interval '20 minutes';
    ld := ln::date;

    for m in
      select hm.id, coalesce(hm.locale, h.loc) like 'es%' as es,
             coalesce(p.events, true) as p_events, coalesce(p.event_lead_min, 30) as p_lead,
             coalesce(p.plans, true) as p_plans, coalesce(p.blocks, true) as p_blocks,
             coalesce(p.supplements, true) as p_supp, coalesce(p.supplements_at, time '09:00') as p_supp_at,
             coalesce(p.goals, true) as p_goals, coalesce(p.goals_at, time '20:30') as p_goals_at
        from public.household_members hm
        left join public.notify_prefs p on p.member_id = hm.id
       where hm.household_id = h.id and hm.is_active and hm.user_id is not null
         and exists (select 1 from public.push_subscriptions s where s.member_id = hm.id)
    loop
      es := m.es;

      -- 1) Olaylar ------------------------------------------------------------
      if m.p_events then
        for e in
          select ce.id, ce.title, ce.location, ce.all_day, ce.rrule, ce.exdates, ce.reminder_minutes,
                 (ce.starts_at at time zone h.tz) as lst
            from public.calendar_events ce
           where ce.household_id = h.id and ce.notify
             and ((ce.rrule is null and ce.starts_at between p_now - interval '1 day' and p_now + interval '3 days')
                  or (ce.rrule is not null and ce.starts_at <= p_now + interval '3 days'))
             -- Katılımcısı olduğum ya da katılımcısı hiç yazılmamış (haneye ait) olay.
             and (exists (select 1 from public.event_attendees a where a.event_id = ce.id and a.member_id = m.id)
                  or not exists (select 1 from public.event_attendees a where a.event_id = ce.id))
        loop
          leads := case when coalesce(array_length(e.reminder_minutes, 1), 0) = 0
                        then array[m.p_lead] else e.reminder_minutes end;
          foreach d in array array[ld, ld + 1, ld + 2] loop
            continue when not public.rrule_occurs(e.rrule, e.lst::date, e.exdates, d);
            occ := d + e.lst::time;
            foreach l in array leads loop
              f := case when e.all_day then
                        case when l >= 1440 then (d - 1) + time '20:00' else d + time '08:00' end
                        else occ - make_interval(mins => l) end;
              continue when not (f > lo and f <= ln);
              txt := case
                when e.all_day and d = ld then (case when es then 'Hoy' else 'Bugün' end)
                when e.all_day then (case when es then 'Mañana' else 'Yarın' end)
                when l = 0 then (case when es then 'Empieza ahora' else 'Şimdi başlıyor' end)
                when l < 60 then l || (case when es then ' min' else ' dk sonra' end)
                when l % 60 = 0 and l < 1440 then (l / 60) || (case when es then ' h' else ' saat sonra' end)
                else to_char(occ, 'DD.MM HH24:MI') end;
              perform public.push_enqueue(m.id,
                case when e.all_day then '📅 ' else '⏰ ' || to_char(occ, 'HH24:MI') || ' · ' end || e.title,
                txt || coalesce(' · ' || e.location, ''),
                '/takvim/?d=' || d, 'ev-' || e.id || '-' || d,
                'ev:' || e.id || ':' || d || ':' || l, p_now);
              n := n + 1;
            end loop;
          end loop;
        end loop;
      end if;

      -- 2) Planlar -----------------------------------------------------------
      if m.p_plans then
        for pl in
          select p.id, p.title, p.icon, p.destination, p.starts_on, p.start_time
            from public.plans p
           where p.household_id = h.id and p.kind <> 'goal'
             and p.status in ('planned', 'active') and p.starts_on in (ld, ld + 1)
        loop
          -- Bir gün önce akşam
          f := (pl.starts_on - 1) + time '20:00';
          if f > lo and f <= ln then
            perform public.push_enqueue(m.id,
              (case when es then 'Mañana: ' else 'Yarın: ' end) || coalesce(pl.icon || ' ', '') || pl.title,
              concat_ws(' · ', to_char(pl.start_time, 'HH24:MI'), pl.destination),
              '/planlar/', 'pl-' || pl.id, 'pl:' || pl.id || ':eve:' || pl.starts_on, p_now);
            n := n + 1;
          end if;
          -- Aynı gün: saat varsa 2 saat önce, yoksa sabah 08:00
          f := case when pl.start_time is not null then pl.starts_on + pl.start_time - interval '2 hours'
                    else pl.starts_on + time '08:00' end;
          if f > lo and f <= ln then
            perform public.push_enqueue(m.id,
              case when pl.start_time is not null
                   then (case when es then 'En 2 horas: ' else '2 saat sonra: ' end)
                   else (case when es then 'Hoy: ' else 'Bugün: ' end) end
                || coalesce(pl.icon || ' ', '') || pl.title,
              concat_ws(' · ', to_char(pl.start_time, 'HH24:MI'), pl.destination),
              '/planlar/', 'pl-' || pl.id, 'pl:' || pl.id || ':day:' || pl.starts_on, p_now);
            n := n + 1;
          end if;
        end loop;
      end if;

      -- 3) Günlük düzen blokları (kişisel, 0021) ------------------------------
      if m.p_blocks then
        for b in
          select db.id, db.title, db.icon, db.starts_at, db.ends_at
            from public.day_blocks db
           where db.member_id = m.id and db.notify
             and db.scope = case when extract(isodow from ld) >= 6 then 'weekend' else 'weekday' end
             and not exists (select 1 from public.day_block_logs dbl where dbl.block_id = db.id and dbl.on_date = ld)
        loop
          f := ld + b.starts_at;
          continue when not (f > lo and f <= ln);
          perform public.push_enqueue(m.id,
            '⏱️ ' || coalesce(b.icon || ' ', '') || b.title,
            to_char(b.starts_at, 'HH24:MI') || '–' || to_char(b.ends_at, 'HH24:MI'),
            '/gunum/', 'bl-' || ld, 'bl:' || b.id || ':' || ld, p_now);
          n := n + 1;
        end loop;
      end if;

      -- 4) Takviyeler (kişisel, 0022) ----------------------------------------
      if m.p_supp then
        f := ld + m.p_supp_at;
        if f > lo and f <= ln then
          select string_agg(s.title, ', ' order by s.sort_order, s.created_at) into txt
            from public.supplements s
            left join public.supplement_logs sl on sl.supplement_id = s.id and sl.on_date = ld
           where s.member_id = m.id and s.is_active and coalesce(sl.taken, 0) < s.per_day;
          if txt is not null then
            perform public.push_enqueue(m.id,
              case when es then '💊 Hora de los suplementos' else '💊 Takviye zamanı' end,
              txt, '/gunum/', 'sp-' || ld, 'sp:' || ld, p_now);
            n := n + 1;
          end if;
        end if;
      end if;

      -- 5) Günlük hedefler (kişisel, 0021) ------------------------------------
      if m.p_goals then
        f := ld + m.p_goals_at;
        if f > lo and f <= ln then
          select string_agg(g.title || ' ' || coalesce(gl.amount, 0) || '/' || g.target
                            || coalesce(' ' || g.unit, ''), ', ' order by g.sort_order, g.created_at) into txt
            from public.goals g
            left join public.goal_logs gl on gl.goal_id = g.id and gl.on_date = ld
           where g.member_id = m.id and g.is_active and g.kind = 'daily'
             and coalesce(gl.amount, 0) < g.target;
          if txt is not null then
            perform public.push_enqueue(m.id,
              case when es then '🎯 Metas de hoy' else '🎯 Bugünün hedefleri' end,
              txt, '/gunum/', 'gl-' || ld, 'gl:' || ld, p_now);
            n := n + 1;
          end if;
        end if;
      end if;
    end loop;
  end loop;
  return n;
end $$;

-- ---------------------------------------------------------------------------
-- Uygulama içi bildirimler (sabah özeti, vade, belge) → telefona da.
create or replace function public.notifications_to_push()
returns trigger language plpgsql security definer set search_path = public as $$
declare m record;
begin
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
drop trigger if exists notifications_push on public.notifications;
create trigger notifications_push after insert on public.notifications
  for each row execute function public.notifications_to_push();

-- ---------------------------------------------------------------------------
-- Gönderici (Edge Function) için — yalnızca service_role
create or replace function public.push_config()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'public',  (select decrypted_secret from vault.decrypted_secrets where name = 'yuva_vapid_public'),
    'private', (select decrypted_secret from vault.decrypted_secrets where name = 'yuva_vapid_private'),
    'cron',    (select decrypted_secret from vault.decrypted_secrets where name = 'yuva_push_cron'));
$$;

create or replace function public.push_claim(p_limit int default 200)
returns table (outbox_id bigint, sub_id uuid, endpoint text, p256dh text, auth text, payload jsonb)
language plpgsql security definer set search_path = public as $$
begin
  return query
  with c as (
    select o.id from public.push_outbox o
     where o.sent_at is null and o.fire_at <= now() and o.fire_at > now() - interval '6 hours'
       and o.attempts < 5 and (o.claimed_at is null or o.claimed_at < now() - interval '5 minutes')
     order by o.fire_at
     limit greatest(1, least(coalesce(p_limit, 200), 500))
     for update skip locked
  ), u as (
    update public.push_outbox o set claimed_at = now(), attempts = o.attempts + 1
      from c where o.id = c.id
    returning o.id, o.member_id, o.title, o.body, o.url, o.tag
  )
  select u.id, s.id, s.endpoint, s.p256dh, s.auth,
         jsonb_build_object('title', u.title, 'body', u.body, 'url', u.url, 'tag', u.tag)
    from u join public.push_subscriptions s on s.member_id = u.member_id;
end $$;

create or replace function public.push_report(p jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare r jsonb;
begin
  for r in select * from jsonb_array_elements(coalesce(p, '[]'::jsonb)) loop
    if (r->>'ok')::boolean then
      update public.push_outbox set sent_at = coalesce(sent_at, now()) where id = (r->>'outbox_id')::bigint;
      update public.push_subscriptions set last_ok_at = now(), fail_count = 0 where id = (r->>'sub_id')::uuid;
    elsif (r->>'status') in ('404', '410') then
      -- Telefon aboneliği bırakmış (uygulama silindi, izin geri alındı).
      delete from public.push_subscriptions where id = (r->>'sub_id')::uuid;
    else
      update public.push_subscriptions set fail_count = fail_count + 1 where id = (r->>'sub_id')::uuid;
      delete from public.push_subscriptions where id = (r->>'sub_id')::uuid and fail_count >= 10;
    end if;
  end loop;
end $$;

-- Her dakika: hesapla, gönderilecek varsa göndericiyi dürt, eskiyi temizle.
create or replace function public.push_tick()
returns void language plpgsql security definer set search_path = public, extensions as $$
begin
  perform public.push_schedule(now());
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

-- ---------------------------------------------------------------------------
-- Uygulamanın çağırdıkları
create or replace function public.push_vapid_public()
returns text language sql stable security definer set search_path = public as $$
  select decrypted_secret from vault.decrypted_secrets where name = 'yuva_vapid_public';
$$;

create or replace function public.push_subscribe(hid uuid, p_endpoint text, p_p256dh text, p_auth text, p_ua text default null)
returns void language plpgsql security definer set search_path = public as $$
declare mid uuid;
begin
  mid := public.my_member_id(hid);
  if mid is null then raise exception 'yetki yok'; end if;
  if p_endpoint !~ '^https://' then raise exception 'geçersiz abonelik'; end if;
  insert into public.push_subscriptions (household_id, member_id, user_id, endpoint, p256dh, auth, ua)
  values (hid, mid, auth.uid(), p_endpoint, p_p256dh, p_auth, left(p_ua, 300))
  on conflict (endpoint) do update
     set household_id = excluded.household_id, member_id = excluded.member_id, user_id = excluded.user_id,
         p256dh = excluded.p256dh, auth = excluded.auth, ua = excluded.ua, fail_count = 0;
  insert into public.notify_prefs (member_id, household_id) values (mid, hid) on conflict do nothing;
end $$;

create or replace function public.push_unsubscribe(p_endpoint text)
returns void language sql security definer set search_path = public as $$
  delete from public.push_subscriptions where endpoint = p_endpoint and user_id = auth.uid();
$$;

create or replace function public.notify_prefs_get(hid uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare mid uuid; r jsonb;
begin
  mid := public.my_member_id(hid);
  if mid is null then raise exception 'yetki yok'; end if;
  select to_jsonb(p) - 'household_id' - 'member_id' - 'updated_at' into r from public.notify_prefs p where member_id = mid;
  return coalesce(r, jsonb_build_object('events', true, 'event_lead_min', 30, 'plans', true, 'blocks', true,
                     'supplements', true, 'supplements_at', '09:00', 'goals', true, 'goals_at', '20:30', 'digest', true))
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
    updated_at     = now()
  where member_id = mid;
end $$;

-- "Deneme bildirimi gönder" düğmesi. Kaç cihaza gideceğini döner.
create or replace function public.push_test(hid uuid, p_title text, p_body text)
returns int language plpgsql security definer set search_path = public as $$
declare mid uuid;
begin
  mid := public.my_member_id(hid);
  if mid is null then raise exception 'yetki yok'; end if;
  perform public.push_enqueue(mid, left(p_title, 80), left(p_body, 200), '/', 'test',
                              'test:' || extract(epoch from clock_timestamp())::text, now());
  return (select count(*) from public.push_subscriptions where member_id = mid);
end $$;

-- ---------------------------------------------------------------------------
-- Yetkiler: sunucu tarafı fonksiyonlar kimseye açık değil.
revoke all on function public.rrule_occurs(text, date, date[], date)                      from public, anon;
revoke all on function public.push_enqueue(uuid, text, text, text, text, text, timestamptz) from public, anon, authenticated;
revoke all on function public.push_schedule(timestamptz)                                   from public, anon, authenticated;
revoke all on function public.notifications_to_push()                                      from public, anon, authenticated;
revoke all on function public.push_config()                                                from public, anon, authenticated;
revoke all on function public.push_claim(int)                                              from public, anon, authenticated;
revoke all on function public.push_report(jsonb)                                           from public, anon, authenticated;
revoke all on function public.push_tick()                                                  from public, anon, authenticated;
grant execute on function public.push_config()      to service_role;
grant execute on function public.push_claim(int)    to service_role;
grant execute on function public.push_report(jsonb) to service_role;

revoke all on function public.push_vapid_public()                              from public, anon;
revoke all on function public.push_subscribe(uuid, text, text, text, text)     from public, anon;
revoke all on function public.push_unsubscribe(text)                           from public, anon;
revoke all on function public.notify_prefs_get(uuid)                           from public, anon;
revoke all on function public.notify_prefs_set(uuid, jsonb)                    from public, anon;
revoke all on function public.push_test(uuid, text, text)                      from public, anon;
grant execute on function public.push_vapid_public()                          to authenticated;
grant execute on function public.push_subscribe(uuid, text, text, text, text) to authenticated;
grant execute on function public.push_unsubscribe(text)                       to authenticated;
grant execute on function public.notify_prefs_get(uuid)                       to authenticated;
grant execute on function public.notify_prefs_set(uuid, jsonb)                to authenticated;
grant execute on function public.push_test(uuid, text, text)                  to authenticated;

-- ---------------------------------------------------------------------------
-- Her dakika çalış. (Önceki kayıt varsa değiştir.)
do $$ begin
  perform cron.unschedule('yuva-push') where exists (select 1 from cron.job where jobname = 'yuva-push');
exception when others then null; end $$;
select cron.schedule('yuva-push', '* * * * *', 'select public.push_tick();');
