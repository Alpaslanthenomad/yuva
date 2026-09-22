-- 0014 — "Geri al" görevi eski vadesine döndürmüyordu (0010 hatası)
--
-- 0010'da tekrarlayan görev tamamlanınca vade sonraki tekrara taşınıyor.
-- task_uncomplete ise yalnızca is_done'u false yapıp tamamlama kaydını
-- siliyordu; vade ileride kalıyordu. Sonuç: yanlışlıkla işaretlenen haftalık
-- bir iş "geri alındıktan" sonra bu hafta listede hiç görünmüyor, gelecek
-- haftaya kaçmış oluyordu. Dış incelemede yakalandı.
--
-- Çözüm: tamamlama kaydı, taşımadan ÖNCEKİ vadeyi saklasın; geri alma onu
-- yerine koysun. Eski kayıtlarda alan boş kalır — o zaman vadeye dokunulmaz
-- (eski davranış), yanlış bir tarihe döndürmekten iyidir.

alter table public.task_completions add column if not exists prev_due_on date;

create or replace function public.task_complete(p_task_id uuid, p_next_due date default null)
returns public.tasks language plpgsql security definer set search_path = public as $$
declare out_row public.tasks;
begin
  select * into out_row from public.tasks where id = p_task_id;
  if out_row.id is null then raise exception 'görev bulunamadı'; end if;
  if not public.is_household_member(out_row.household_id) then raise exception 'yetki yok'; end if;

  insert into public.task_completions (household_id, task_id, member_id, points, prev_due_on)
  values (out_row.household_id, out_row.id,
          coalesce(out_row.assignee_member_id, public.my_member_id(out_row.household_id)),
          coalesce(out_row.points, 0),
          out_row.due_on);

  if p_next_due is not null then
    update public.tasks
       set due_on = p_next_due, is_done = false, done_at = null, updated_at = now()
     where id = p_task_id returning * into out_row;
  else
    update public.tasks
       set is_done = true, done_at = now(), updated_at = now()
     where id = p_task_id returning * into out_row;
  end if;

  return out_row;
end $$;

create or replace function public.task_uncomplete(p_task_id uuid)
returns public.tasks language plpgsql security definer set search_path = public as $$
declare out_row public.tasks; v_id uuid; v_prev date; v_had boolean := false;
begin
  select * into out_row from public.tasks where id = p_task_id;
  if out_row.id is null then raise exception 'görev bulunamadı'; end if;
  if not public.is_household_member(out_row.household_id) then raise exception 'yetki yok'; end if;

  -- En son tamamlama: hem silinecek hem de eski vadeyi taşıyor.
  select id, prev_due_on, true into v_id, v_prev, v_had
    from public.task_completions
   where task_id = p_task_id
   order by created_at desc limit 1;

  if v_id is not null then
    delete from public.task_completions where id = v_id;
  end if;

  update public.tasks
     set is_done = false, done_at = null,
         -- prev_due_on yoksa (0014 öncesi kayıt) vadeye dokunma.
         due_on = case when v_had and v_prev is not null then v_prev else due_on end,
         updated_at = now()
   where id = p_task_id returning * into out_row;

  return out_row;
end $$;
