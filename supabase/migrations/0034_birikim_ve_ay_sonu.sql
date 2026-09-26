-- 0034 — Birikim hedefine otomatik aylık katkı + ay sonu özeti
--
-- İSTEK: "birikim hedefine otomatik katkı ve ay sonu özeti"
--
-- 1) OTOMATİK KATKI
--    Hedefte (plans.kind = 'goal') "her ayın N'inde şu kadar" ayarlanır.
--    O gün (hanenin saatiyle 08:00'den sonra) katkı kendiliğinden yazılır,
--    not: 'otomatik'. Ay kaçırıldıysa (sunucu kapalıydı vb.) o ay içinde ilk
--    fırsatta yazılır; geçmiş ayları geriye doğru doldurmaz. Hedefe ulaşınca
--    durur. Yetişkinlere "🐖 Tatil fonu: +$50.000 (%42)" bildirimi gider.
--    Katkı bir harcama DEĞİL (birikim); Bütçe toplamlarını etkilemez —
--    elle girilen katkılarla aynı davranış.
--
-- 2) AY SONU ÖZETİ
--    Ayın 1'inde 09:30'da tek bildirim, geçen ay için: aile harcaması ve bir
--    önceki aya göre fark, gelir ve kalan, aşılan limitler, en çok artan
--    kategori, benim kişisel harcamam (limitim varsa durumu) ve hedeflere
--    giden birikim. Kişiye göre; eşin kişisel harcaması girmez (0029).
--    Ayarlar'dan kapatılır ve "şimdi gör" ile önizlenir.

alter table public.plans add column if not exists auto_amount numeric(14,2);
alter table public.plans add column if not exists auto_day    smallint;
alter table public.plans add column if not exists auto_last   date;
alter table public.plans drop constraint if exists plans_auto_day_aralik;
alter table public.plans add constraint plans_auto_day_aralik check (auto_day is null or auto_day between 1 and 28);
alter table public.notify_prefs add column if not exists monthly boolean not null default true;

-- ---------------------------------------------------------------------------
-- 1. Otomatik katkı
-- ---------------------------------------------------------------------------
create or replace function public.goal_auto_tick(p_now timestamptz default now())
returns integer language plpgsql security definer set search_path = public as $$
declare g record; ln timestamp; ld date; hedef_gun date; toplam numeric; yuzde int; n int := 0; m record; es boolean;
begin
  for g in
    select p.*, coalesce(nullif(h.timezone, ''), 'America/Santiago') as tz, coalesce(h.locale, 'tr') as hloc,
           h.base_currency
      from public.plans p join public.households h on h.id = p.household_id
     where p.kind = 'goal' and coalesce(p.auto_amount, 0) > 0 and p.auto_day is not null
       and p.status not in ('done', 'cancelled')
  loop
    ln := p_now at time zone g.tz;
    ld := ln::date;
    continue when ln::time < time '08:00';
    hedef_gun := make_date(extract(year from ld)::int, extract(month from ld)::int, g.auto_day);
    continue when ld < hedef_gun;                                  -- bu ayın günü gelmedi
    continue when g.auto_last is not null and g.auto_last >= hedef_gun;   -- bu ay yazıldı

    select coalesce(sum(case when c.currency = coalesce(g.budget_currency, g.base_currency) then c.amount else c.amount_base end), 0)
      into toplam from public.goal_contributions c where c.plan_id = g.id;
    if coalesce(g.target_amount, 0) > 0 and toplam >= g.target_amount then
      update public.plans set auto_last = ld where id = g.id;      -- hedefe ulaşıldı; yazma
      continue;
    end if;

    insert into public.goal_contributions (plan_id, household_id, amount, currency, on_date, note)
    values (g.id, g.household_id, g.auto_amount, coalesce(g.budget_currency, g.base_currency), ld, 'otomatik');
    update public.plans set auto_last = ld where id = g.id;
    n := n + 1;

    toplam := toplam + g.auto_amount;
    yuzde := case when coalesce(g.target_amount, 0) > 0 then least(100, round(100 * toplam / g.target_amount))::int end;
    for m in
      select hm.id, coalesce(hm.locale, g.hloc) like 'es%' as es
        from public.household_members hm
       where hm.household_id = g.household_id and hm.is_active and hm.user_id is not null and hm.role = 'adult'
    loop
      es := m.es;
      perform public.push_enqueue(m.id,
        '🐖 ' || g.title || ': +' || public.para_yaz(g.auto_amount, coalesce(g.budget_currency, g.base_currency)),
        case when yuzde is null then (case when es then 'Aporte automático registrado' else 'Otomatik katkı yazıldı' end)
             when es then 'Vas en ' || yuzde || '% de la meta'
             else 'Hedef: %' || yuzde || ' tamam' end,
        '/planlar/', 'ga-' || g.id, 'ga:' || g.id || ':' || ld, p_now);
    end loop;
  end loop;
  return n;
end $$;
revoke all on function public.goal_auto_tick(timestamptz) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. Ay sonu özeti
-- ---------------------------------------------------------------------------
create or replace function public.monthly_digest(p_member uuid, p_period character)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  mm record; es boolean; ccy text; d1 date; d2 date; o1 date;
  v_fam numeric; v_prev numeric; v_inc numeric; v_mine numeric; v_lim numeric; v_bir numeric;
  asan text; artan record; parts text[] := '{}'; ay text;
begin
  select hm.id, hm.household_id, hm.role, hm.is_active, coalesce(hm.locale, h.locale, 'tr') as loc, h.base_currency
    into mm
    from public.household_members hm join public.households h on h.id = hm.household_id
   where hm.id = p_member;
  if mm.id is null or mm.role <> 'adult' or not mm.is_active then return null; end if;
  es := mm.loc like 'es%';
  ccy := mm.base_currency;
  d1 := to_date(p_period || '-01', 'YYYY-MM-DD');
  d2 := (d1 + interval '1 month')::date;
  o1 := (d1 - interval '1 month')::date;
  ay := case when es
    then (array['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'])[extract(month from d1)::int]
    else (array['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık'])[extract(month from d1)::int] end;

  select coalesce(sum(amount_base) filter (where kind = 'expense' and for_member_id is null and occurred_on >= d1), 0),
         coalesce(sum(amount_base) filter (where kind = 'expense' and for_member_id is null and occurred_on < d1), 0),
         coalesce(sum(amount_base) filter (where kind = 'income' and occurred_on >= d1), 0),
         coalesce(sum(amount_base) filter (where kind = 'expense' and for_member_id = p_member and occurred_on >= d1), 0)
    into v_fam, v_prev, v_inc, v_mine
    from public.transactions
   where household_id = mm.household_id and occurred_on >= o1 and occurred_on < d2;

  if v_fam > 0 then
    parts := parts || ((case when es then 'Familia: ' else 'Aile: ' end) || public.para_yaz(v_fam, ccy)
      || case when v_prev > 0 then ' (' || case when v_fam >= v_prev then '▲' else '▼' end
              || round(abs(v_fam - v_prev) * 100 / v_prev) || '%' || case when es then ' vs. mes anterior)' else ' önceki aya göre)' end
         else '' end);
  end if;
  if v_inc > 0 then
    parts := parts || ((case when es then 'Ingresos: ' else 'Gelir: ' end) || public.para_yaz(v_inc, ccy)
      || ' · ' || (case when es then 'queda ' else 'kalan ' end) || public.para_yaz(v_inc - v_fam, ccy)
      || case when v_inc > v_fam then ' (%' || round(100 * (v_inc - v_fam) / v_inc) || ')' else '' end);
  end if;

  -- Aşılan limitler (0029'daki taşınan limit kuralıyla).
  with gecerli as (
    select distinct on (b.category_id) b.category_id, b.amount_base
      from public.budgets b
     where b.household_id = mm.household_id and b.period <= p_period
     order by b.category_id, b.period desc
  ),
  sp as (
    select coalesce(pc.id, cc.id) cid, sum(t.amount_base) total
      from public.transactions t
      left join public.categories cc on cc.id = t.category_id
      left join public.categories pc on pc.id = cc.parent_id
     where t.household_id = mm.household_id and t.kind = 'expense' and t.for_member_id is null
       and t.occurred_on >= d1 and t.occurred_on < d2
     group by 1)
  select string_agg(coalesce(c.name, case when es then 'Total' else 'Toplam' end), ', ')
    into asan
    from gecerli g
    left join public.categories c on c.id = g.category_id
   where g.amount_base > 0
     and (case when g.category_id is null then v_fam else coalesce((select total from sp where sp.cid = g.category_id), 0) end) > g.amount_base;
  if asan is not null then
    parts := parts || ((case when es then '⚠️ Límite superado: ' else '⚠️ Limit aşıldı: ' end) || asan);
  end if;

  -- En çok artan kategori (aile harcaması, üst kategori).
  with x as (
    select coalesce(pc.id, cc.id) cid,
           sum(t.amount_base) filter (where t.occurred_on >= d1) as bu,
           coalesce(sum(t.amount_base) filter (where t.occurred_on < d1), 0) as once
      from public.transactions t
      left join public.categories cc on cc.id = t.category_id
      left join public.categories pc on pc.id = cc.parent_id
     where t.household_id = mm.household_id and t.kind = 'expense' and t.for_member_id is null
       and t.occurred_on >= o1 and t.occurred_on < d2
     group by 1)
  select c.name, c.icon, x.bu - x.once as fark into artan
    from x join public.categories c on c.id = x.cid
   where coalesce(x.bu, 0) - x.once > 0
   order by x.bu - x.once desc limit 1;
  if artan.name is not null then
    parts := parts || ((case when es then 'Lo que más subió: ' else 'En çok artan: ' end)
      || coalesce(artan.icon || ' ', '') || artan.name || ' +' || public.para_yaz(artan.fark, ccy));
  end if;

  -- Benim kişisel harcamam
  select amount_base into v_lim from public.personal_limits where member_id = p_member;
  if v_mine > 0 then
    parts := parts || ((case when es then 'Tu gasto personal: ' else 'Kişisel harcaman: ' end) || public.para_yaz(v_mine, ccy)
      || case when v_lim > 0 then ' / ' || public.para_yaz(v_lim, ccy) || case when v_mine > v_lim then ' ⚠️' else ' ✓' end else '' end);
  end if;

  -- Birikim
  select coalesce(sum(c.amount_base), 0) into v_bir
    from public.goal_contributions c
   where c.household_id = mm.household_id and c.on_date >= d1 and c.on_date < d2;
  if v_bir > 0 then
    parts := parts || ((case when es then '🐖 Ahorrado para metas: ' else '🐖 Hedeflere birikim: ' end) || public.para_yaz(v_bir, ccy));
  end if;

  if coalesce(array_length(parts, 1), 0) = 0 then return null; end if;
  return jsonb_build_object(
    'title', case when es then '📅 Resumen de ' || ay else '📅 ' || ay || ' özeti' end,
    'body', array_to_string(parts, E'\n'),
    'parts', to_jsonb(parts),
    'period', p_period);
end $$;
revoke all on function public.monthly_digest(uuid, character) from public, anon, authenticated;

create or replace function public.monthly_digest_preview(hid uuid, p_period character default null)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare mid uuid; tz text; ld date;
begin
  mid := public.my_member_id(hid);
  if mid is null or not public.can_see_money(hid) then raise exception 'yetki yok'; end if;
  select coalesce(nullif(timezone, ''), 'America/Santiago') into tz from public.households where id = hid;
  ld := (now() at time zone tz)::date;
  return public.monthly_digest(mid, coalesce(p_period, to_char(ld - interval '1 month', 'YYYY-MM')));
end $$;
revoke all on function public.monthly_digest_preview(uuid, character) from public, anon;
grant execute on function public.monthly_digest_preview(uuid, character) to authenticated;

create or replace function public.push_schedule_monthly(p_now timestamptz default now())
returns integer language plpgsql security definer set search_path = public as $$
declare h record; m record; ln timestamp; ld date; f timestamp; dg jsonb; per text; n int := 0;
begin
  for h in select id, coalesce(nullif(timezone, ''), 'America/Santiago') as tz
             from public.households
            where exists (select 1 from public.push_subscriptions s where s.household_id = households.id)
  loop
    ln := p_now at time zone h.tz;
    ld := ln::date;
    continue when extract(day from ld) <> 1;
    f := ld + time '09:30';
    continue when not (f > ln - interval '20 minutes' and f <= ln);
    per := to_char(ld - interval '1 month', 'YYYY-MM');
    for m in
      select hm.id from public.household_members hm
        left join public.notify_prefs p on p.member_id = hm.id
       where hm.household_id = h.id and hm.is_active and hm.user_id is not null and hm.role = 'adult'
         and coalesce(p.monthly, true)
         and exists (select 1 from public.push_subscriptions s where s.member_id = hm.id)
    loop
      dg := public.monthly_digest(m.id, per);
      continue when dg is null;
      perform public.push_enqueue(m.id, dg->>'title', dg->>'body', '/para/?sekme=report', 'mo-' || per, 'mo:' || per, p_now);
      n := n + 1;
    end loop;
  end loop;
  return n;
end $$;
revoke all on function public.push_schedule_monthly(timestamptz) from public, anon, authenticated;

create or replace function public.push_tick()
returns void language plpgsql security definer set search_path = public, extensions as $$
begin
  perform public.push_schedule(now());
  perform public.push_schedule_weekly(now());
  perform public.push_schedule_occasions(now());
  perform public.push_schedule_bills(now());
  perform public.push_schedule_monthly(now());
  perform public.goal_auto_tick(now());
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
                     'weekly', true, 'weekly_at', '19:00', 'occasions', true, 'bills', true, 'monthly', true))
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
    monthly        = coalesce((p->>'monthly')::boolean, monthly),
    updated_at     = now()
  where member_id = mid;
end $$;
