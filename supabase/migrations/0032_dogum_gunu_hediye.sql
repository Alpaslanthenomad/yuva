-- 0032 — Doğum günü / yıldönümü hediye hatırlatması
--
-- İSTEK: "Doğum günü hediye hatırlatması: bir hafta önce 'Hediye düşündün
-- mü?' bildirimi, bağlı bir plan ve hediye masrafıyla birlikte."
--
-- NASIL:
--   • Önemli günler (occasions) zaten vardı; 'remind_days' (varsayılan 7) ve
--     'gift_ideas' alanları da. Eksik olan bildirim ve plan bağıydı.
--   • Günü gelince (remind_days gün önce, saat 10:00) doğum günü ve
--     yıldönümleri için "🎁 … 7 gün sonra" bildirimi. Dokununca Planlar'da
--     hazır doldurulmuş bir hediye planı açılır (kutlama türü, o günün
--     tarihi, hediye fikri not olarak); masrafı planın içinden girilir ve
--     0028 sayesinde Bütçe'ye düşer.
--   • Plan zaten kurulduysa bildirim "Hediye planı hazır ✓" der.
--   • Günün kendisinde 08:00'de "🎂 Bugün: …".
--   • Kişinin KENDİ doğum günü için kendisine hediye hatırlatması gitmez.
--   • Ayarlar'dan kapatılabilir (notify_prefs.occasions).

alter table public.plans add column if not exists occasion_id uuid references public.occasions(id) on delete set null;
create index if not exists plans_occasion on public.plans (occasion_id) where occasion_id is not null;
alter table public.notify_prefs add column if not exists occasions boolean not null default true;

-- Önemli günün p_from'dan itibaren ilk tekrarı. 29 Şubat artık yılda 28'ine düşer.
create or replace function public.occasion_next(p_month int, p_day int, p_from date)
returns date language plpgsql immutable set search_path = public as $$
declare y int := extract(year from p_from)::int; d date;
begin
  for i in 0..1 loop
    d := make_date(y + i, p_month,
           least(p_day, extract(day from (make_date(y + i, p_month, 1) + interval '1 month - 1 day'))::int));
    if d >= p_from then return d; end if;
  end loop;
  return d;
end $$;

create or replace function public.push_schedule_occasions(p_now timestamptz default now())
returns integer language plpgsql security definer set search_path = public as $$
declare h record; m record; o record; ln timestamp; ld date; d date; kalan int; f timestamp;
        planli boolean; n int := 0; es boolean;
begin
  for h in select id, coalesce(nullif(timezone, ''), 'America/Santiago') as tz, coalesce(locale, 'tr') as loc
             from public.households
            where exists (select 1 from public.push_subscriptions s where s.household_id = households.id)
  loop
    ln := p_now at time zone h.tz;
    ld := ln::date;
    for m in
      select hm.id, coalesce(hm.locale, h.loc) like 'es%' as es
        from public.household_members hm
        left join public.notify_prefs p on p.member_id = hm.id
       where hm.household_id = h.id and hm.is_active and hm.user_id is not null
         and coalesce(p.occasions, true)
         and exists (select 1 from public.push_subscriptions s where s.member_id = hm.id)
    loop
      es := m.es;
      for o in select * from public.occasions where household_id = h.id loop
        continue when o.member_id is not distinct from m.id;   -- kendi günü
        d := public.occasion_next(o.month, o.day, ld);
        kalan := d - ld;

        -- Hediye hatırlatması (doğum günü ve yıldönümü)
        if o.kind in ('birthday', 'anniversary') and coalesce(o.remind_days, 7) > 0
           and kalan = coalesce(o.remind_days, 7) then
          f := ld + time '10:00';
          if f > ln - interval '20 minutes' and f <= ln then
            planli := exists (select 1 from public.plans p where p.occasion_id = o.id and p.starts_on = d);
            perform public.push_enqueue(m.id,
              '🎁 ' || o.title || case when es then ' · en ' || kalan || ' días' else ' · ' || kalan || ' gün sonra' end,
              case when planli then (case when es then 'Plan de regalo listo ✓' else 'Hediye planı hazır ✓' end)
                   when nullif(o.gift_ideas, '') is not null
                     then (case when es then 'Idea de regalo: ' else 'Hediye fikri: ' end) || o.gift_ideas
                   else (case when es then '¿Pensaste en un regalo? Toca y armamos el plan.'
                              else 'Hediye düşündün mü? Dokun, planı birlikte açalım.' end) end,
              case when planli then '/planlar/' else '/planlar/?hediye=' || o.id || '&d=' || d end,
              'oc-' || o.id, 'oc:' || o.id || ':' || d || ':gift', p_now);
            n := n + 1;
          end if;
        end if;

        -- Günün kendisi
        if kalan = 0 then
          f := ld + time '08:00';
          if f > ln - interval '20 minutes' and f <= ln then
            perform public.push_enqueue(m.id,
              case when o.kind = 'birthday' then '🎂 ' when o.kind = 'anniversary' then '💍 ' else '📌 ' end
                || (case when es then 'Hoy: ' else 'Bugün: ' end) || o.title,
              coalesce(nullif(o.gift_ideas, ''), ''),
              '/', 'oc-' || o.id, 'oc:' || o.id || ':' || d || ':day', p_now);
            n := n + 1;
          end if;
        end if;
      end loop;
    end loop;
  end loop;
  return n;
end $$;
revoke all on function public.push_schedule_occasions(timestamptz) from public, anon, authenticated;
revoke all on function public.occasion_next(int, int, date) from public, anon;

create or replace function public.push_tick()
returns void language plpgsql security definer set search_path = public, extensions as $$
begin
  perform public.push_schedule(now());
  perform public.push_schedule_weekly(now());
  perform public.push_schedule_occasions(now());
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
                     'weekly', true, 'weekly_at', '19:00', 'occasions', true))
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
    updated_at     = now()
  where member_id = mid;
end $$;
