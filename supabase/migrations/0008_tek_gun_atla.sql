-- 0008 — Tekrarlayan olayda tek günü atlama
-- Sorun: bir tekrarı silmek tüm seriyi siliyordu. `calendar_events.exdates`
-- kolonu ve `expandRRule`'un exdates desteği 0001'den beri vardı, ama hiçbir
-- yerden yazılmıyordu.
-- Diziyi oku-değiştir-yaz yapmak iki tur ve yarış koşulu demek; iş mantığı
-- DB'de kalsın diye RPC olarak yazıldı.

create or replace function public.event_skip_occurrence(p_event_id uuid, p_date date)
returns public.calendar_events language plpgsql security definer set search_path = public as $$
declare out_row public.calendar_events; v_ex date[];
begin
  select * into out_row from public.calendar_events where id = p_event_id;
  if out_row.id is null then raise exception 'olay bulunamadı'; end if;
  if not public.is_household_member(out_row.household_id) then raise exception 'yetki yok'; end if;
  if out_row.rrule is null then raise exception 'tekrarsız olayda tek gün atlanamaz'; end if;

  v_ex := coalesce(out_row.exdates, '{}'::date[]);
  if not (p_date = any(v_ex)) then
    v_ex := v_ex || p_date;
  end if;

  update public.calendar_events
     set exdates = v_ex, updated_at = now()
   where id = p_event_id
  returning * into out_row;

  return out_row;
end $$;

revoke all on function public.event_skip_occurrence(uuid, date) from public;
grant execute on function public.event_skip_occurrence(uuid, date) to authenticated;
