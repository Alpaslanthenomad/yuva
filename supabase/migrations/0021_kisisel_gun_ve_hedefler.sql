-- 0021 — Kişisel gün planı ve hedefler
--
-- NEDEN: hane ortak bir uygulama ama disiplin kişisel. Kullanıcının isteği:
-- "sabah kalkıştan akşam yatışa kadar planlı olabileceğim kişisel bir sayfa...
-- bu sayfanın ortak olmasına gerek yok, Carolina kendi disiplinini ayrı
-- belirleyecek."
--
-- BU TABLOLAR HANE GENELİ DEĞİL, ÜYEYE ÖZEL. Aynı hanenin diğer üyesi bu
-- satırları GÖREMEZ. Uygulamadaki ilk kişisel veri bu; RLS hane değil üye
-- düzeyinde kuruluyor.
--
-- ŞABLON HAFTA İÇİ / HAFTA SONU. Yedi ayrı gün kurmak yedi kat iş; şablonsuz
-- bırakmak her sabah kurmayı gerektirir ve unutulur.
--
-- YÜZDELER VERİTABANINDA HESAPLANIYOR (ARCHITECTURE §3). Ön yüz çiziyor.

create or replace function public.my_member_id(hid uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select id from public.household_members
   where household_id = hid and user_id = auth.uid() and is_active
   limit 1;
$$;

create table if not exists public.day_blocks (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references public.households(id) on delete cascade,
  member_id     uuid not null references public.household_members(id) on delete cascade,
  scope         text not null check (scope in ('weekday', 'weekend')),
  title         text not null,
  icon          text,
  starts_at     time not null,
  ends_at       time not null,
  sort_order    int  not null default 0,
  created_at    timestamptz not null default now(),
  -- Gece yarısını aşan blok yok: "23:00-01:00" iki güne yayılır ve tutturma
  -- kaydının hangi güne yazılacağı belirsizleşir. Gerekirse iki blok kurulur.
  check (ends_at > starts_at)
);

create table if not exists public.day_block_logs (
  block_id   uuid not null references public.day_blocks(id) on delete cascade,
  on_date    date not null,
  member_id  uuid not null references public.household_members(id) on delete cascade,
  done_at    timestamptz not null default now(),
  primary key (block_id, on_date)
);

-- kind:
--   'daily'  — her gün şu kadar (30 dakika okuma) -> bugünkü / hedef
--   'weekly' — haftada şu kadar KEZ (3 gün spor)  -> bu hafta kaç gün / hedef
--   'total'  — dönem boyunca birikim (yılda 12 kitap) -> toplam / hedef
create table if not exists public.goals (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references public.households(id) on delete cascade,
  member_id     uuid not null references public.household_members(id) on delete cascade,
  title         text not null,
  icon          text,
  kind          text not null check (kind in ('daily', 'weekly', 'total')),
  target        numeric not null check (target > 0),
  unit          text,
  starts_on     date not null default current_date,
  ends_on       date,
  is_active     boolean not null default true,
  sort_order    int not null default 0,
  created_at    timestamptz not null default now()
);

create table if not exists public.goal_logs (
  goal_id   uuid not null references public.goals(id) on delete cascade,
  on_date   date not null,
  member_id uuid not null references public.household_members(id) on delete cascade,
  amount    numeric not null default 0,
  primary key (goal_id, on_date)
);

create index if not exists day_blocks_uye on public.day_blocks (member_id, scope);
create index if not exists goals_uye on public.goals (member_id) where is_active;
create index if not exists goal_logs_tarih on public.goal_logs (goal_id, on_date);

alter table public.day_blocks     enable row level security;
alter table public.day_block_logs enable row level security;
alter table public.goals          enable row level security;
alter table public.goal_logs      enable row level security;

do $$
declare t text;
begin
  foreach t in array array['day_blocks','day_block_logs','goals','goal_logs'] loop
    execute format('drop policy if exists %I on public.%I', t || '_kendi', t);
    execute format(
      'create policy %I on public.%I for all '
      'using (member_id in (select id from public.household_members where user_id = auth.uid() and is_active)) '
      'with check (member_id in (select id from public.household_members where user_id = auth.uid() and is_active))',
      t || '_kendi', t);
  end loop;
end $$;

create or replace function public.my_day(hid uuid, p_date date default current_date)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare mid uuid; v_scope text; res jsonb;
begin
  mid := public.my_member_id(hid);
  if mid is null then raise exception 'yetki yok'; end if;
  v_scope := case when extract(isodow from p_date) >= 6 then 'weekend' else 'weekday' end;

  select jsonb_build_object(
    'date', p_date,
    'scope', v_scope,
    'blocks', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'id', b.id, 'title', b.title, 'icon', b.icon,
               'starts_at', to_char(b.starts_at, 'HH24:MI'),
               'ends_at',   to_char(b.ends_at, 'HH24:MI'),
               'done', (l.block_id is not null))
             order by b.starts_at, b.sort_order), '[]'::jsonb)
        from public.day_blocks b
        left join public.day_block_logs l on l.block_id = b.id and l.on_date = p_date
       where b.member_id = mid and b.scope = v_scope),
    -- Son 7 günün tutturma oranı. Bloğu olmayan gün paydaya girmez; yoksa
    -- oran haksız yere düşük çıkar.
    'adherence7', (
      select case when coalesce(sum(x.toplam), 0) = 0 then null
                  else round(100.0 * sum(x.yapilan) / sum(x.toplam)) end
        from (
          select (select count(*) from public.day_blocks b
                   where b.member_id = mid
                     and b.scope = case when extract(isodow from g) >= 6 then 'weekend' else 'weekday' end) as toplam,
                 (select count(*) from public.day_block_logs l
                   where l.member_id = mid and l.on_date = g::date) as yapilan
            from generate_series(p_date - 6, p_date, interval '1 day') g
        ) x)
  ) into res;
  return res;
end $$;

create or replace function public.my_goals(hid uuid, p_date date default current_date)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare mid uuid; res jsonb; hb date;
begin
  mid := public.my_member_id(hid);
  if mid is null then raise exception 'yetki yok'; end if;
  hb := p_date - (extract(isodow from p_date)::int - 1);

  with ham as (
    select g.*,
      case g.kind
        when 'daily'  then coalesce((select amount from public.goal_logs where goal_id = g.id and on_date = p_date), 0)
        when 'weekly' then (select count(*) from public.goal_logs
                             where goal_id = g.id and amount > 0 and on_date between hb and hb + 6)
        else (select coalesce(sum(amount), 0) from public.goal_logs
               where goal_id = g.id and on_date >= g.starts_on
                 and (g.ends_on is null or on_date <= g.ends_on))
      end as ilerleme
      from public.goals g
     where g.member_id = mid and g.is_active
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', id, 'title', title, 'icon', icon, 'kind', kind,
    'target', target, 'unit', unit,
    'today', coalesce((select amount from public.goal_logs where goal_id = ham.id and on_date = p_date), 0),
    'progress', ilerleme,
    -- Yüzde 100'de KESİLİYOR: hedefin üstüne çıkmak güzel ama çubuğun taşması
    -- ekranı bozar; gerçek değer 'progress' alanında duruyor.
    'pct', least(100, round(100.0 * ilerleme / target))
  ) order by sort_order, created_at), '[]'::jsonb)
  into res from ham;

  return res;
end $$;

create or replace function public.block_toggle(hid uuid, p_block uuid, p_date date default current_date)
returns boolean language plpgsql security definer set search_path = public as $$
declare mid uuid; vardi boolean;
begin
  mid := public.my_member_id(hid);
  if mid is null then raise exception 'yetki yok'; end if;
  if not exists (select 1 from public.day_blocks where id = p_block and member_id = mid) then
    raise exception 'yetki yok';   -- başkasının bloğuna dokunulamaz
  end if;
  select exists (select 1 from public.day_block_logs where block_id = p_block and on_date = p_date) into vardi;
  if vardi then
    delete from public.day_block_logs where block_id = p_block and on_date = p_date;
    return false;
  end if;
  insert into public.day_block_logs (block_id, on_date, member_id) values (p_block, p_date, mid);
  return true;
end $$;

create or replace function public.goal_log_set(hid uuid, p_goal uuid, p_amount numeric, p_date date default current_date)
returns numeric language plpgsql security definer set search_path = public as $$
declare mid uuid;
begin
  mid := public.my_member_id(hid);
  if mid is null then raise exception 'yetki yok'; end if;
  if not exists (select 1 from public.goals where id = p_goal and member_id = mid) then
    raise exception 'yetki yok';
  end if;
  -- Sıfır yazmak "yapmadım" demek; satırı siliyoruz ki haftalık sayım doğru kalsın.
  if coalesce(p_amount, 0) <= 0 then
    delete from public.goal_logs where goal_id = p_goal and on_date = p_date;
    return 0;
  end if;
  insert into public.goal_logs (goal_id, on_date, member_id, amount)
  values (p_goal, p_date, mid, p_amount)
  on conflict (goal_id, on_date) do update set amount = excluded.amount;
  return p_amount;
end $$;

revoke all on function public.my_member_id(uuid)                      from public, anon;
revoke all on function public.my_day(uuid, date)                      from public, anon;
revoke all on function public.my_goals(uuid, date)                    from public, anon;
revoke all on function public.block_toggle(uuid, uuid, date)          from public, anon;
revoke all on function public.goal_log_set(uuid, uuid, numeric, date) from public, anon;
grant execute on function public.my_member_id(uuid)                      to authenticated;
grant execute on function public.my_day(uuid, date)                      to authenticated;
grant execute on function public.my_goals(uuid, date)                    to authenticated;
grant execute on function public.block_toggle(uuid, uuid, date)          to authenticated;
grant execute on function public.goal_log_set(uuid, uuid, numeric, date) to authenticated;
