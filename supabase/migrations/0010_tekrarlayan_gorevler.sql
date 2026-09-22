-- 0010 — Tekrarlayan görevler
-- Sorun: `tasks.rrule` kolonu 0001'den beri var ama hiçbir yerden kullanılmıyordu.
-- `toggle` yalnızca `is_done`'u çeviriyordu; tekrarlayan bir ev işi bir kez
-- yapıldı mı sonsuza kadar "bitti" kalıyor, bir daha gündeme gelmiyordu.
--
-- Karar: görev tamamlanınca satır "bitti" işaretlenmez, vadesi bir sonraki
-- tekrara taşınır ve is_done false kalır. Böylece tek satır seriyi temsil eder
-- (takvimdeki tekrarlayan olayla aynı mantık).
--
-- Bu, puan geçmişini kaybettirir: due_on ilerleyince done_at silinir. O yüzden
-- tamamlamalar ayrı tabloya yazılır — haftalık puan artık oradan okunuyor.
-- Tekrarsız görevler de aynı tabloya yazar, tek bir kaynak olsun.
--
-- Sonraki tarihi DB hesaplamaz: RRULE açılımı CLAUDE.md'de açıkça ön yüze
-- bırakılmış tek mantık. Ön yüz `nextOccurrence()` ile hesaplar ve parametre
-- olarak geçer.

create table if not exists public.task_completions (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  task_id uuid not null references public.tasks(id) on delete cascade,
  member_id uuid references public.household_members(id) on delete set null,
  done_on date not null default current_date,
  points int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists tc_household_done_idx
  on public.task_completions(household_id, done_on desc);
create index if not exists tc_task_idx on public.task_completions(task_id);

alter table public.task_completions enable row level security;

-- Görevler hanede ortak: üye okur ve yazar (0001'deki tasks politikasıyla aynı).
drop policy if exists tc_all on public.task_completions;
create policy tc_all on public.task_completions for all
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

-- ---------------------------------------------------------------------------
-- Tamamla
-- ---------------------------------------------------------------------------
-- p_next_due verilirse (tekrarlayan görev) vade oraya taşınır, görev açık kalır.
-- Verilmezse görev bitti sayılır.
create or replace function public.task_complete(p_task_id uuid, p_next_due date default null)
returns public.tasks language plpgsql security definer set search_path = public as $$
declare out_row public.tasks;
begin
  select * into out_row from public.tasks where id = p_task_id;
  if out_row.id is null then raise exception 'görev bulunamadı'; end if;
  if not public.is_household_member(out_row.household_id) then raise exception 'yetki yok'; end if;

  insert into public.task_completions (household_id, task_id, member_id, points)
  values (out_row.household_id, out_row.id,
          coalesce(out_row.assignee_member_id, public.my_member_id(out_row.household_id)),
          coalesce(out_row.points, 0));

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

-- ---------------------------------------------------------------------------
-- Geri al — yanlış işaretlemeyi düzeltmek için
-- ---------------------------------------------------------------------------
create or replace function public.task_uncomplete(p_task_id uuid)
returns public.tasks language plpgsql security definer set search_path = public as $$
declare out_row public.tasks;
begin
  select * into out_row from public.tasks where id = p_task_id;
  if out_row.id is null then raise exception 'görev bulunamadı'; end if;
  if not public.is_household_member(out_row.household_id) then raise exception 'yetki yok'; end if;

  -- Yalnızca en son tamamlama silinir; geçmiş kayıtlara dokunulmaz.
  delete from public.task_completions
   where id = (select id from public.task_completions
                where task_id = p_task_id order by created_at desc limit 1);

  update public.tasks
     set is_done = false, done_at = null, updated_at = now()
   where id = p_task_id returning * into out_row;
  return out_row;
end $$;

-- ---------------------------------------------------------------------------
-- Ertele — vadeyi kaydırır, tamamlama yazmaz
-- ---------------------------------------------------------------------------
create or replace function public.task_postpone(p_task_id uuid, p_days int default 1)
returns public.tasks language plpgsql security definer set search_path = public as $$
declare out_row public.tasks;
begin
  select * into out_row from public.tasks where id = p_task_id;
  if out_row.id is null then raise exception 'görev bulunamadı'; end if;
  if not public.is_household_member(out_row.household_id) then raise exception 'yetki yok'; end if;
  if p_days < 1 or p_days > 365 then raise exception 'erteleme 1-365 gün arası olmalı'; end if;

  update public.tasks
     set due_on = coalesce(due_on, current_date) + p_days,
         is_done = false, done_at = null, updated_at = now()
   where id = p_task_id returning * into out_row;
  return out_row;
end $$;

-- ---------------------------------------------------------------------------
-- Atla — bu seferi yapmadan sonraki tekrara geç, tamamlama yazmaz
-- ---------------------------------------------------------------------------
create or replace function public.task_skip(p_task_id uuid, p_next_due date)
returns public.tasks language plpgsql security definer set search_path = public as $$
declare out_row public.tasks;
begin
  select * into out_row from public.tasks where id = p_task_id;
  if out_row.id is null then raise exception 'görev bulunamadı'; end if;
  if not public.is_household_member(out_row.household_id) then raise exception 'yetki yok'; end if;
  if out_row.rrule is null then raise exception 'tekrarsız görev atlanamaz'; end if;

  update public.tasks
     set due_on = p_next_due, is_done = false, done_at = null, updated_at = now()
   where id = p_task_id returning * into out_row;
  return out_row;
end $$;

-- ---------------------------------------------------------------------------
-- Yetkiler (0003 kuralı) + canlı yenileme (0009 kuralı)
-- ---------------------------------------------------------------------------
revoke all on function public.task_complete(uuid, date) from public;
revoke all on function public.task_uncomplete(uuid) from public;
revoke all on function public.task_postpone(uuid, int) from public;
revoke all on function public.task_skip(uuid, date) from public;
grant execute on function public.task_complete(uuid, date) to authenticated;
grant execute on function public.task_uncomplete(uuid) to authenticated;
grant execute on function public.task_postpone(uuid, int) to authenticated;
grant execute on function public.task_skip(uuid, date) to authenticated;

alter table public.task_completions replica identity full;
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime' and schemaname = 'public'
       and tablename = 'task_completions'
  ) then
    alter publication supabase_realtime add table public.task_completions;
  end if;
end $$;
