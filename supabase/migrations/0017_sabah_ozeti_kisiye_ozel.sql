-- 0017 — Sabah özeti kişiye özel yazılır
--
-- 0013 hane başına TEK bildirim yazıyordu ve `member_id` boştu (= herkese).
-- Sonuç: sabah bildirimi "3 randevu, 2 iş" diyor ama bunların hangisi bana ait
-- belli değil; karşı tarafın işleri de sayıya giriyor. Dış incelemede
-- "alıcı üyeye göre süzülmüyor" diye geçti — doğru tespit.
--
-- Bildirim tablosu ve RLS bunu zaten destekliyor (0001): `member_id` dolu olan
-- bildirimi yalnızca o üye görüyor. Eksik olan, yazan tarafın kişiye ayırması.
--
-- Bu sürümde:
--   • Randevu  → üyenin katılımcı olduğu olaylar + katılımcısı hiç olmayan
--     olaylar (katılımcı yazılmamış olay haneye aittir, herkesi ilgilendirir).
--   • İş       → üyeye atanmış işler + kimseye atanmamış işler.
--   • Belge / özel gün → hane geneli; herkeste aynı görünür.
--
-- Bildirim yalnızca GİRİŞ YAPABİLEN üyelere yazılır: çocuk profillerinin
-- hesabı yok (CLAUDE.md), onlara yazılan bildirimi kimse okuyamaz.
--
-- Yapacak bir şey yoksa yine yazılmaz; günde bir kez, üye başına.

create or replace function public.post_morning_digest()
returns int language plpgsql security definer set search_path = public as $$
declare m record; n int := 0;
        v_events int; v_due int; v_late int; v_docs int; v_occ int;
        v_parts text[]; v_title text; v_body text; v_tr boolean;
begin
  for m in
    select hm.id as member_id, hm.household_id, h.locale
      from public.household_members hm
      join public.households h on h.id = hm.household_id
     where hm.is_active and hm.user_id is not null
  loop
    -- Randevular: katılımcısı olduğum + katılımcısı hiç yazılmamış olaylar.
    select count(*) into v_events
      from public.calendar_events e
     where e.household_id = m.household_id
       and e.starts_at >= current_date
       and e.starts_at <  current_date + 1
       and (
         exists (select 1 from public.event_attendees a
                  where a.event_id = e.id and a.member_id = m.member_id)
         or not exists (select 1 from public.event_attendees a where a.event_id = e.id)
       );

    -- İşler: bana atanmış + kimseye atanmamış.
    select count(*) filter (where due_on = current_date),
           count(*) filter (where due_on < current_date)
      into v_due, v_late
      from public.tasks
     where household_id = m.household_id and not is_done and due_on is not null
       and (assignee_member_id = m.member_id or assignee_member_id is null);

    select count(*) into v_docs
      from public.documents d
     where d.household_id = m.household_id and d.expires_on is not null
       and d.expires_on <= current_date + coalesce(d.remind_days, 30);

    select count(*) into v_occ
      from public.occasions o
     where o.household_id = m.household_id
       and make_date(extract(year from current_date)::int, o.month, o.day) = current_date;

    if v_events = 0 and v_due = 0 and v_late = 0 and v_docs = 0 and v_occ = 0 then
      continue;
    end if;

    -- Aynı üyeye aynı gün ikinci kez yazma (cron iki kez çalışsa bile).
    if exists (
      select 1 from public.notifications
       where household_id = m.household_id and member_id = m.member_id and kind = 'digest'
         and fire_at >= current_date and fire_at < current_date + 1
    ) then
      continue;
    end if;

    v_tr := coalesce(m.locale, 'tr') like 'tr%';
    v_parts := array[]::text[];
    if v_events > 0 then v_parts := v_parts || (v_events || (case when v_tr then ' randevu' else ' eventos' end)); end if;
    if v_due   > 0 then v_parts := v_parts || (v_due   || (case when v_tr then ' iş' else ' tareas' end)); end if;
    if v_late  > 0 then v_parts := v_parts || (v_late  || (case when v_tr then ' geciken' else ' atrasadas' end)); end if;
    if v_docs  > 0 then v_parts := v_parts || (v_docs  || (case when v_tr then ' belge' else ' documentos' end)); end if;
    if v_occ   > 0 then v_parts := v_parts || (v_occ   || (case when v_tr then ' özel gün' else ' fechas especiales' end)); end if;

    v_title := case when v_tr then 'Bugün' else 'Hoy' end;
    v_body  := array_to_string(v_parts, ' · ');

    insert into public.notifications (household_id, member_id, title, body, kind)
    values (m.household_id, m.member_id, v_title, v_body, 'digest');
    n := n + 1;
  end loop;
  return n;
end $$;

revoke all on function public.post_morning_digest() from public;
