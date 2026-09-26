-- 0030 — Pazar akşamı haftalık özet (tek bildirim)
--
-- İSTEK: "Pazar akşamı haftalık özet. Tek bildirimle: aile harcaması, kişisel
-- harcaman, günlük düzene uyum ve önümüzdeki hafta."
--
-- İÇERİK (kişiye göre; her parça yalnızca anlamlıysa):
--   • Aile harcaması bu hafta (Pzt–Paz) ve geçen haftaya göre fark
--   • Benim kişisel harcamam (eşinki DEĞİL — 0029 gizliliğiyle tutarlı)
--   • Günüm uyumu: 7 günde yapılan blok / planlanan blok
--   • Önümüzdeki 7 gün: bana ait olay sayısı, plan sayısı ve ilk plan
-- Para kısmı yalnızca parayı görebilen (yetişkin) üyeye gider.
-- Varsayılan Pazar 19:00 (hanenin saat diliminde); Ayarlar'dan kapatılır
-- ya da saati değiştirilir.

alter table public.notify_prefs add column if not exists weekly    boolean not null default true;
alter table public.notify_prefs add column if not exists weekly_at time    not null default time '19:00';

-- Tutarı okunur yaz: CLP → "$245.000"; diğerleri → "1,234.50 USD".
create or replace function public.para_yaz(x numeric, ccy text)
returns text language sql immutable set search_path = public as $$
  select case when ccy = 'CLP'
              then '$' || replace(to_char(round(coalesce(x, 0)), 'FM999,999,999,990'), ',', '.')
              else to_char(coalesce(x, 0), 'FM999,999,999,990.00') || ' ' || ccy end;
$$;

-- Bir üyenin haftalık özeti. p_end: haftanın son günü (Pazar), yerel tarih.
create or replace function public.weekly_digest(p_member uuid, p_end date)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  mm record; es boolean; ccy text;
  v_fam numeric; v_prev numeric; v_mine numeric; v_top int; v_don int;
  v_ev int := 0; v_pl int; v_first record; d date; e record;
  parts text[] := '{}'; gunler text[];
begin
  select hm.id, hm.household_id, hm.role, hm.is_active, coalesce(hm.locale, h.locale, 'tr') as loc,
         h.base_currency, coalesce(nullif(h.timezone, ''), 'America/Santiago') as tz
    into mm
    from public.household_members hm join public.households h on h.id = hm.household_id
   where hm.id = p_member;
  if mm.id is null then return null; end if;
  es := mm.loc like 'es%';
  ccy := mm.base_currency;
  gunler := case when es then array['lun','mar','mié','jue','vie','sáb','dom']
                 else array['Pzt','Sal','Çar','Per','Cum','Cmt','Paz'] end;

  -- Para (yalnızca yetişkin)
  if mm.role = 'adult' and mm.is_active then
    select coalesce(sum(amount_base) filter (where for_member_id is null and occurred_on between p_end - 6 and p_end), 0),
           coalesce(sum(amount_base) filter (where for_member_id is null and occurred_on between p_end - 13 and p_end - 7), 0),
           coalesce(sum(amount_base) filter (where for_member_id = p_member and occurred_on between p_end - 6 and p_end), 0)
      into v_fam, v_prev, v_mine
      from public.transactions
     where household_id = mm.household_id and kind = 'expense' and occurred_on between p_end - 13 and p_end;
    if v_fam > 0 or v_prev > 0 then
      parts := parts || ((case when es then 'Familia: ' else 'Aile: ' end) || public.para_yaz(v_fam, ccy)
        || case when v_prev > 0 then
             ' (' || case when v_fam >= v_prev then '▲' else '▼' end
                  || round(abs(v_fam - v_prev) * 100 / v_prev) || '%'
                  || case when es then ' vs. semana pasada)' else ' geçen haftaya göre)' end
           else '' end);
    end if;
    if v_mine > 0 then
      parts := parts || ((case when es then 'Tu gasto personal: ' else 'Kişisel harcaman: ' end) || public.para_yaz(v_mine, ccy));
    end if;
  end if;

  -- Günüm uyumu
  select coalesce(sum((select count(*) from public.day_blocks b
                        where b.member_id = p_member
                          and b.scope = case when extract(isodow from g) >= 6 then 'weekend' else 'weekday' end)), 0),
         coalesce(sum((select count(*) from public.day_block_logs l
                        where l.member_id = p_member and l.on_date = g::date)), 0)
    into v_top, v_don
    from generate_series(p_end - 6, p_end, interval '1 day') g;
  if v_top > 0 then
    parts := parts || ((case when es then 'Mi día: ' else 'Günüm uyumu: %' end)
      || round(100.0 * v_don / v_top) || case when es then '%' else '' end);
  end if;

  -- Önümüzdeki 7 gün: bana ait (ya da katılımcısız) olaylar
  for e in
    select ce.id, ce.rrule, ce.exdates, (ce.starts_at at time zone mm.tz)::date as sd
      from public.calendar_events ce
     where ce.household_id = mm.household_id
       and ((ce.rrule is null and (ce.starts_at at time zone mm.tz)::date between p_end + 1 and p_end + 7)
            or (ce.rrule is not null and (ce.starts_at at time zone mm.tz)::date <= p_end + 7))
       and (exists (select 1 from public.event_attendees a where a.event_id = ce.id and a.member_id = p_member)
            or not exists (select 1 from public.event_attendees a where a.event_id = ce.id))
  loop
    if e.rrule is null then
      v_ev := v_ev + 1;
    else
      for d in select generate_series(p_end + 1, p_end + 7, interval '1 day')::date loop
        if public.rrule_occurs(e.rrule, e.sd, e.exdates, d) then v_ev := v_ev + 1; end if;
      end loop;
    end if;
  end loop;

  select count(*) into v_pl from public.plans p
   where p.household_id = mm.household_id and p.kind <> 'goal'
     and p.status in ('planned', 'active') and p.starts_on between p_end + 1 and p_end + 7;
  select p.title, p.icon, p.starts_on into v_first from public.plans p
   where p.household_id = mm.household_id and p.kind <> 'goal'
     and p.status in ('planned', 'active') and p.starts_on between p_end + 1 and p_end + 7
   order by p.starts_on, p.start_time nulls last limit 1;

  if v_ev > 0 or v_pl > 0 then
    parts := parts || ((case when es then 'Próxima semana: ' else 'Önümüzdeki hafta: ' end)
      || concat_ws(' · ',
           case when v_ev > 0 then v_ev || case when es then ' eventos' else ' olay' end end,
           case when v_pl > 0 then v_pl || case when es then ' planes' else ' plan' end end)
      || case when v_first.title is not null
              then ' (' || gunler[extract(isodow from v_first.starts_on)::int] || ': '
                   || coalesce(v_first.icon || ' ', '') || v_first.title || ')' else '' end);
  end if;

  if coalesce(array_length(parts, 1), 0) = 0 then return null; end if;
  return jsonb_build_object(
    'title', case when es then '📊 Resumen de la semana' else '📊 Haftanın özeti' end,
    'body',  array_to_string(parts, E'\n'),
    'parts', to_jsonb(parts));
end $$;
revoke all on function public.weekly_digest(uuid, date) from public, anon, authenticated;
revoke all on function public.para_yaz(numeric, text)   from public, anon;

-- Ayarlar'daki "Önizle": şu ana kadarki haftanın özeti, benim için.
create or replace function public.weekly_digest_preview(hid uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare mid uuid; tz text;
begin
  mid := public.my_member_id(hid);
  if mid is null then raise exception 'yetki yok'; end if;
  select coalesce(nullif(timezone, ''), 'America/Santiago') into tz from public.households where id = hid;
  return public.weekly_digest(mid, (now() at time zone tz)::date);
end $$;
revoke all on function public.weekly_digest_preview(uuid) from public, anon;
grant execute on function public.weekly_digest_preview(uuid) to authenticated;

-- Zamanlayıcı: Pazar günü seçilen saatte (20 dakikalık pencere, tekrar yok).
create or replace function public.push_schedule_weekly(p_now timestamptz default now())
returns integer language plpgsql security definer set search_path = public as $$
declare h record; m record; ln timestamp; ld date; f timestamp; dg jsonb; n int := 0;
begin
  for h in select id, coalesce(nullif(timezone, ''), 'America/Santiago') as tz
             from public.households
            where exists (select 1 from public.push_subscriptions s where s.household_id = households.id)
  loop
    ln := p_now at time zone h.tz;
    ld := ln::date;
    continue when extract(isodow from ld) <> 7;
    for m in
      select hm.id, coalesce(p.weekly, true) as w, coalesce(p.weekly_at, time '19:00') as w_at
        from public.household_members hm
        left join public.notify_prefs p on p.member_id = hm.id
       where hm.household_id = h.id and hm.is_active and hm.user_id is not null
         and exists (select 1 from public.push_subscriptions s where s.member_id = hm.id)
    loop
      continue when not m.w;
      f := ld + m.w_at;
      continue when not (f > ln - interval '20 minutes' and f <= ln);
      dg := public.weekly_digest(m.id, ld);
      continue when dg is null;
      perform public.push_enqueue(m.id, dg->>'title', dg->>'body', '/', 'wk-' || ld, 'wk:' || ld, p_now);
      n := n + 1;
    end loop;
  end loop;
  return n;
end $$;
revoke all on function public.push_schedule_weekly(timestamptz) from public, anon, authenticated;

create or replace function public.push_tick()
returns void language plpgsql security definer set search_path = public, extensions as $$
begin
  perform public.push_schedule(now());
  perform public.push_schedule_weekly(now());
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

-- Tercihler: yeni iki alan.
create or replace function public.notify_prefs_get(hid uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare mid uuid; r jsonb;
begin
  mid := public.my_member_id(hid);
  if mid is null then raise exception 'yetki yok'; end if;
  select to_jsonb(p) - 'household_id' - 'member_id' - 'updated_at' into r from public.notify_prefs p where member_id = mid;
  return coalesce(r, jsonb_build_object('events', true, 'event_lead_min', 30, 'plans', true, 'blocks', true,
                     'supplements', true, 'supplements_at', '09:00', 'goals', true, 'goals_at', '20:30', 'digest', true,
                     'weekly', true, 'weekly_at', '19:00'))
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
    updated_at     = now()
  where member_id = mid;
end $$;
