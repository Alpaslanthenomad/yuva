-- 0013 — Sabah özeti ve bildirim merkezi
--
-- Bildirimler tablosu 0001'den beri var ama içine yalnızca düzenli gider
-- vadeleri düşüyordu (0011). Uygulamayı açmadan günün ne getirdiğini görmenin
-- yolu yoktu.
--
-- Sabah özeti: her hane için günde bir bildirim. İçeriği o günün olayları,
-- vadesi gelen/geçen işler, yaklaşan belge süreleri ve önemli günler.
-- Yapacak bir şey yoksa bildirim YAZILMAZ — her sabah "bugün hiçbir şey yok"
-- bildirimi almak uygulamayı sessize aldırır.
--
-- Metin dile duyarlı: hane `locale` alanına göre TR veya ES.

create or replace function public.post_morning_digest()
returns int language plpgsql security definer set search_path = public as $$
declare h record; n int := 0;
        v_events int; v_due int; v_late int; v_docs int; v_occ int;
        v_parts text[]; v_title text; v_body text; v_tr boolean;
begin
  for h in select id, locale from public.households loop
    select count(*) into v_events
      from public.calendar_events e
     where e.household_id = h.id
       and e.starts_at >= current_date
       and e.starts_at <  current_date + 1;

    select count(*) filter (where due_on = current_date),
           count(*) filter (where due_on < current_date)
      into v_due, v_late
      from public.tasks
     where household_id = h.id and not is_done and due_on is not null;

    select count(*) into v_docs
      from public.documents d
     where d.household_id = h.id and d.expires_on is not null
       and d.expires_on <= current_date + coalesce(d.remind_days, 30);

    select count(*) into v_occ
      from public.occasions o
     where o.household_id = h.id
       and make_date(extract(year from current_date)::int, o.month, o.day) = current_date;

    -- Söylenecek bir şey yoksa geç.
    if v_events = 0 and v_due = 0 and v_late = 0 and v_docs = 0 and v_occ = 0 then
      continue;
    end if;

    v_tr := coalesce(h.locale, 'tr') like 'tr%';
    v_parts := array[]::text[];
    if v_events > 0 then v_parts := v_parts || (v_events || (case when v_tr then ' randevu' else ' eventos' end)); end if;
    if v_due   > 0 then v_parts := v_parts || (v_due   || (case when v_tr then ' iş' else ' tareas' end)); end if;
    if v_late  > 0 then v_parts := v_parts || (v_late  || (case when v_tr then ' geciken' else ' atrasadas' end)); end if;
    if v_docs  > 0 then v_parts := v_parts || (v_docs  || (case when v_tr then ' belge' else ' documentos' end)); end if;
    if v_occ   > 0 then v_parts := v_parts || (v_occ   || (case when v_tr then ' özel gün' else ' fechas especiales' end)); end if;

    v_title := case when v_tr then 'Bugün' else 'Hoy' end;
    v_body  := array_to_string(v_parts, ' · ');

    -- Aynı gün ikinci kez yazma (cron iki kez çalışsa bile).
    if exists (
      select 1 from public.notifications
       where household_id = h.id and kind = 'digest'
         and fire_at >= current_date and fire_at < current_date + 1
    ) then
      continue;
    end if;

    insert into public.notifications (household_id, title, body, kind)
    values (h.id, v_title, v_body, 'digest');
    n := n + 1;
  end loop;
  return n;
end $$;

revoke all on function public.post_morning_digest() from public;

-- Santiago UTC-3 → 10:00 UTC ≈ sabah 07:00
do $$
begin
  if exists (select 1 from cron.job where jobname = 'yuva-morning-digest') then
    perform cron.unschedule('yuva-morning-digest');
  end if;
  perform cron.schedule('yuva-morning-digest', '0 10 * * *',
                        'select public.post_morning_digest();');
end $$;
