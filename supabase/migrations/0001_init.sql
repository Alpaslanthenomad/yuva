-- ============================================================================
-- YUVA — 0001_init.sql
-- Hane, üyeler, takvim, para, planlar, aile, görevler, alışveriş, bildirim.
-- RLS + trigger + RPC. Idempotent olmaya çalışır.
-- ============================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- 0. Enum'lar
-- ---------------------------------------------------------------------------
do $$ begin
  create type member_role as enum ('adult','child','guest');
exception when duplicate_object then null; end $$;

do $$ begin
  create type account_type as enum ('cash','bank','card','savings','investment');
exception when duplicate_object then null; end $$;

do $$ begin
  create type txn_kind as enum ('expense','income','transfer');
exception when duplicate_object then null; end $$;

do $$ begin
  create type category_kind as enum ('expense','income');
exception when duplicate_object then null; end $$;

do $$ begin
  create type event_category as enum
    ('work','school','health','social','sport','travel','home','other');
exception when duplicate_object then null; end $$;

do $$ begin
  create type plan_kind as enum ('trip','gathering','project','goal');
exception when duplicate_object then null; end $$;

do $$ begin
  create type plan_status as enum ('idea','planned','active','done','cancelled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type plan_item_kind as enum
    ('itinerary','booking','checklist','guest','note');
exception when duplicate_object then null; end $$;

do $$ begin
  create type occasion_kind as enum
    ('birthday','anniversary','memorial','custom');
exception when duplicate_object then null; end $$;

do $$ begin
  create type document_kind as enum
    ('passport','id','license','visa','insurance','contract','vehicle','other');
exception when duplicate_object then null; end $$;

do $$ begin
  create type rsvp_status as enum ('invited','yes','no','maybe');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- 1. Yardımcı fonksiyonlar
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- ---------------------------------------------------------------------------
-- 2. Profil (auth.users yansıması)
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  avatar_url text,
  default_household_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (user_id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email,'@',1)))
  on conflict (user_id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- 3. Hane ve üyeler
-- ---------------------------------------------------------------------------
create table if not exists public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  base_currency char(3) not null default 'CLP',
  timezone text not null default 'America/Santiago',
  locale text not null default 'tr',
  week_starts_on smallint not null default 1, -- 1 = Pazartesi
  holiday_countries text[] not null default array['CL','TR'],
  join_code text not null unique default upper(substr(encode(gen_random_bytes(6),'hex'),1,8)),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.household_members (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,  -- çocuklarda NULL
  display_name text not null,
  role member_role not null default 'adult',
  color text not null default '#4F7CAC',
  avatar_emoji text default '🙂',
  birthdate date,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (household_id, user_id)
);
create index if not exists hm_household_idx on public.household_members(household_id);
create index if not exists hm_user_idx on public.household_members(user_id);

-- Yetki fonksiyonları (security definer: RLS döngüsünü kırar)
create or replace function public.is_household_member(hid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.household_members m
    where m.household_id = hid and m.user_id = auth.uid() and m.is_active
  );
$$;

create or replace function public.is_household_adult(hid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.household_members m
    where m.household_id = hid and m.user_id = auth.uid()
      and m.is_active and m.role = 'adult'
  );
$$;

create or replace function public.my_member_id(hid uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select m.id from public.household_members m
  where m.household_id = hid and m.user_id = auth.uid() limit 1;
$$;

-- ---------------------------------------------------------------------------
-- 4. Takvim
-- ---------------------------------------------------------------------------
create table if not exists public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  title text not null,
  description text,
  category event_category not null default 'other',
  starts_at timestamptz not null,
  ends_at timestamptz,
  all_day boolean not null default false,
  tz text,
  location text,
  color text,
  rrule text,                 -- RFC 5545, örn. FREQ=WEEKLY;BYDAY=MO
  exdates date[] default '{}',
  reminder_minutes int[] default '{}',
  plan_id uuid,               -- FK aşağıda (plans tablosundan sonra)
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at is null or ends_at >= starts_at)
);
create index if not exists ce_household_start_idx
  on public.calendar_events(household_id, starts_at);

create table if not exists public.event_attendees (
  event_id uuid not null references public.calendar_events(id) on delete cascade,
  member_id uuid not null references public.household_members(id) on delete cascade,
  status rsvp_status not null default 'yes',
  primary key (event_id, member_id)
);

-- ---------------------------------------------------------------------------
-- 5. Para
-- ---------------------------------------------------------------------------
create table if not exists public.fx_rates (
  rate_date date not null,
  base char(3) not null,
  quote char(3) not null,
  rate numeric(18,8) not null,   -- 1 base = rate quote
  source text default 'manual',
  primary key (rate_date, base, quote)
);

-- İşlem tarihinde (veya öncesindeki en son) kuru bul; aynı para → 1
create or replace function public.fx_lookup(p_from char(3), p_to char(3), p_on date)
returns numeric language plpgsql stable as $$
declare r numeric;
begin
  if p_from = p_to then return 1; end if;
  select rate into r from public.fx_rates
    where base = p_from and quote = p_to and rate_date <= p_on
    order by rate_date desc limit 1;
  if r is not null then return r; end if;
  select 1/rate into r from public.fx_rates
    where base = p_to and quote = p_from and rate_date <= p_on
    order by rate_date desc limit 1;
  if r is not null then return r; end if;
  -- USD üzerinden çapraz kur
  select a.rate / b.rate into r
    from (select rate from public.fx_rates where base='USD' and quote=p_to and rate_date<=p_on order by rate_date desc limit 1) a,
         (select rate from public.fx_rates where base='USD' and quote=p_from and rate_date<=p_on order by rate_date desc limit 1) b;
  return r; -- null olabilir → trigger hata verir
end $$;

create table if not exists public.accounts (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name text not null,
  type account_type not null default 'bank',
  currency char(3) not null,
  opening_balance numeric(14,2) not null default 0,
  owner_member_id uuid references public.household_members(id) on delete set null,
  icon text default '🏦',
  is_archived boolean not null default false,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists acc_household_idx on public.accounts(household_id);

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  parent_id uuid references public.categories(id) on delete cascade,
  name text not null,
  kind category_kind not null default 'expense',
  icon text default '🏷️',
  color text,
  is_fixed boolean not null default false,  -- sabit gider mi (kira, abonelik)
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists cat_household_idx on public.categories(household_id);

create table if not exists public.recurring_rules (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name text not null,
  kind txn_kind not null default 'expense',
  amount numeric(14,2) not null,
  currency char(3) not null,
  account_id uuid references public.accounts(id) on delete set null,
  category_id uuid references public.categories(id) on delete set null,
  rrule text not null default 'FREQ=MONTHLY',
  next_due_on date not null,
  reminder_days int not null default 3,
  auto_post boolean not null default false,
  is_active boolean not null default true,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists rr_household_due_idx on public.recurring_rules(household_id, next_due_on);

create table if not exists public.plans (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  kind plan_kind not null default 'trip',
  status plan_status not null default 'planned',
  title text not null,
  description text,
  destination text,
  starts_on date,
  ends_on date,
  budget_amount numeric(14,2),
  budget_currency char(3),
  target_amount numeric(14,2),       -- goal için
  target_account_id uuid references public.accounts(id) on delete set null,
  color text,
  icon text default '✈️',
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists plans_household_idx on public.plans(household_id, starts_on);

alter table public.calendar_events
  drop constraint if exists calendar_events_plan_fk;
alter table public.calendar_events
  add constraint calendar_events_plan_fk
  foreign key (plan_id) references public.plans(id) on delete set null;

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  kind txn_kind not null default 'expense',
  account_id uuid not null references public.accounts(id) on delete restrict,
  transfer_account_id uuid references public.accounts(id) on delete restrict,
  transfer_amount numeric(14,2),  -- farklı para birimine transferde hedef hesaba yazılan tutar
  amount numeric(14,2) not null check (amount > 0),
  currency char(3) not null,
  fx_rate numeric(18,8),          -- trigger doldurur
  amount_base numeric(14,2),      -- trigger doldurur, dondurulur
  occurred_on date not null default current_date,
  category_id uuid references public.categories(id) on delete set null,
  merchant text,
  note text,
  paid_by_member_id uuid references public.household_members(id) on delete set null,
  for_member_id uuid references public.household_members(id) on delete set null,
  tags text[] default '{}',
  receipt_path text,
  recurring_id uuid references public.recurring_rules(id) on delete set null,
  plan_id uuid references public.plans(id) on delete set null,
  event_id uuid references public.calendar_events(id) on delete set null,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (kind <> 'transfer' or transfer_account_id is not null)
);
create index if not exists txn_household_date_idx on public.transactions(household_id, occurred_on desc);
create index if not exists txn_category_idx on public.transactions(category_id);
create index if not exists txn_plan_idx on public.transactions(plan_id);

-- amount_base: sadece INSERT'te ve amount/currency/occurred_on değişince hesaplanır
create or replace function public.transactions_compute_base()
returns trigger language plpgsql security definer set search_path = public as $$
declare base_ccy char(3); r numeric;
begin
  select base_currency into base_ccy from public.households where id = new.household_id;
  if tg_op = 'UPDATE'
     and new.amount = old.amount and new.currency = old.currency
     and new.occurred_on = old.occurred_on then
    new.fx_rate := old.fx_rate; new.amount_base := old.amount_base;
    return new;
  end if;
  r := public.fx_lookup(new.currency, base_ccy, new.occurred_on);
  if r is null then
    raise exception 'fx_rates: % → % için % tarihinde kur yok', new.currency, base_ccy, new.occurred_on;
  end if;
  new.fx_rate := r;
  new.amount_base := round(new.amount * r, 2);
  return new;
end $$;

drop trigger if exists trg_txn_compute_base on public.transactions;
create trigger trg_txn_compute_base
  before insert or update on public.transactions
  for each row execute function public.transactions_compute_base();

create table if not exists public.budgets (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  period char(7) not null,   -- 'YYYY-MM'
  category_id uuid references public.categories(id) on delete cascade, -- NULL = toplam bütçe
  amount_base numeric(14,2) not null,
  rollover boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (household_id, period, category_id)
);

create table if not exists public.plan_items (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.plans(id) on delete cascade,
  household_id uuid not null references public.households(id) on delete cascade,
  kind plan_item_kind not null default 'checklist',
  title text not null,
  on_date date,
  at_time time,
  amount numeric(14,2),
  currency char(3),
  ref_code text,           -- rezervasyon onay kodu
  url text,
  is_done boolean not null default false,
  assignee_member_id uuid references public.household_members(id) on delete set null,
  guest_name text,         -- kind='guest'
  guest_count int,
  rsvp rsvp_status,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists pi_plan_idx on public.plan_items(plan_id);

create table if not exists public.goal_contributions (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.plans(id) on delete cascade,
  household_id uuid not null references public.households(id) on delete cascade,
  amount numeric(14,2) not null,
  currency char(3) not null,
  on_date date not null default current_date,
  transaction_id uuid references public.transactions(id) on delete set null,
  note text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 6. Aile
-- ---------------------------------------------------------------------------
create table if not exists public.occasions (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  title text not null,
  kind occasion_kind not null default 'custom',
  month smallint not null check (month between 1 and 12),
  day smallint not null check (day between 1 and 31),
  year smallint,                        -- biliniyorsa (yaş hesabı)
  member_id uuid references public.household_members(id) on delete cascade,
  person_name text,                     -- hane dışı kişi
  remind_days int not null default 7,
  gift_ideas text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists occ_household_idx on public.occasions(household_id, month, day);

-- Üyeye doğum tarihi girilince otomatik doğum günü kaydı
create or replace function public.sync_member_birthday()
returns trigger language plpgsql security definer set search_path = public as $$
declare suffix text;
begin
  -- Başlık hanenin diline göre: "Deniz doğum günü" / "Deniz - cumpleaños"
  select case when left(coalesce(h.locale,'tr'),2) = 'es' then ' - cumpleaños' else ' doğum günü' end
    into suffix from public.households h where h.id = new.household_id;
  if new.birthdate is null then
    delete from public.occasions where member_id = new.id and kind = 'birthday';
    return new;
  end if;
  if exists (select 1 from public.occasions where member_id = new.id and kind='birthday') then
    update public.occasions
      set month = extract(month from new.birthdate), day = extract(day from new.birthdate),
          year = extract(year from new.birthdate), title = new.display_name || suffix
      where member_id = new.id and kind='birthday';
  else
    insert into public.occasions (household_id, title, kind, month, day, year, member_id)
    values (new.household_id, new.display_name || suffix, 'birthday',
            extract(month from new.birthdate), extract(day from new.birthdate),
            extract(year from new.birthdate), new.id);
  end if;
  return new;
end $$;

drop trigger if exists trg_member_birthday on public.household_members;
create trigger trg_member_birthday
  after insert or update of birthdate, display_name on public.household_members
  for each row execute function public.sync_member_birthday();

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  title text not null,
  kind document_kind not null default 'other',
  member_id uuid references public.household_members(id) on delete set null,
  number_hint text,        -- sadece son 4 hane gibi ipucu; tam numara saklanmaz
  issued_on date,
  expires_on date,
  remind_days int not null default 30,
  file_path text,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists doc_household_exp_idx on public.documents(household_id, expires_on);

create table if not exists public.contacts (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name text not null,
  relation text,
  phone text,
  email text,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 7. Görevler
-- ---------------------------------------------------------------------------
create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  title text not null,
  assignee_member_id uuid references public.household_members(id) on delete set null,
  due_on date,
  rrule text,
  points int not null default 0,
  is_done boolean not null default false,
  done_at timestamptz,
  plan_id uuid references public.plans(id) on delete set null,
  event_id uuid references public.calendar_events(id) on delete set null,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists tasks_household_due_idx on public.tasks(household_id, due_on);

-- ---------------------------------------------------------------------------
-- 8. Alışveriş listesi
-- ---------------------------------------------------------------------------
create table if not exists public.shopping_lists (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name text not null default 'Market',
  icon text default '🛒',
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.shopping_items (
  id uuid primary key default gen_random_uuid(),
  list_id uuid not null references public.shopping_lists(id) on delete cascade,
  household_id uuid not null references public.households(id) on delete cascade,
  name text not null,
  qty text,
  est_amount numeric(14,2),
  is_checked boolean not null default false,
  added_by_member_id uuid references public.household_members(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists si_list_idx on public.shopping_items(list_id);

-- ---------------------------------------------------------------------------
-- 9. Bildirimler ve aktivite günlüğü
-- ---------------------------------------------------------------------------
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  member_id uuid references public.household_members(id) on delete cascade, -- NULL = herkese
  title text not null,
  body text,
  kind text not null default 'info',   -- info | bill_due | doc_expiry | occasion | budget
  entity_type text,
  entity_id uuid,
  fire_at timestamptz not null default now(),
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists notif_member_idx on public.notifications(household_id, member_id, fire_at desc);

create table if not exists public.activity_log (
  id bigserial primary key,
  household_id uuid,
  table_name text not null,
  row_id uuid,
  op text not null,
  actor uuid,
  old_row jsonb,
  new_row jsonb,
  at timestamptz not null default now()
);

create or replace function public.log_activity()
returns trigger language plpgsql security definer set search_path = public as $$
declare hid uuid; rid uuid;
begin
  if tg_op = 'DELETE' then
    hid := old.household_id; rid := old.id;
    insert into public.activity_log(household_id, table_name, row_id, op, actor, old_row)
      values (hid, tg_table_name, rid, tg_op, auth.uid(), to_jsonb(old));
    return old;
  else
    hid := new.household_id; rid := new.id;
    insert into public.activity_log(household_id, table_name, row_id, op, actor, old_row, new_row)
      values (hid, tg_table_name, rid, tg_op, auth.uid(),
              case when tg_op='UPDATE' then to_jsonb(old) end, to_jsonb(new));
    return new;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 10. updated_at ve activity trigger'ları (toplu)
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'profiles','households','household_members','calendar_events','accounts',
    'categories','recurring_rules','plans','transactions','budgets','plan_items',
    'occasions','documents','contacts','tasks','shopping_lists','shopping_items'
  ] loop
    execute format('drop trigger if exists trg_%s_updated on public.%I', t, t);
    execute format('create trigger trg_%s_updated before update on public.%I
                    for each row execute function public.set_updated_at()', t, t);
  end loop;

  foreach t in array array[
    'calendar_events','accounts','categories','recurring_rules','plans',
    'transactions','budgets','plan_items','occasions','documents','tasks',
    'shopping_items','household_members'
  ] loop
    execute format('drop trigger if exists trg_%s_log on public.%I', t, t);
    execute format('create trigger trg_%s_log after insert or update or delete on public.%I
                    for each row execute function public.log_activity()', t, t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 11. RLS
-- ---------------------------------------------------------------------------
alter table public.profiles           enable row level security;
alter table public.households         enable row level security;
alter table public.household_members  enable row level security;
alter table public.calendar_events    enable row level security;
alter table public.event_attendees    enable row level security;
alter table public.fx_rates           enable row level security;
alter table public.accounts           enable row level security;
alter table public.categories         enable row level security;
alter table public.recurring_rules    enable row level security;
alter table public.plans              enable row level security;
alter table public.transactions       enable row level security;
alter table public.budgets            enable row level security;
alter table public.plan_items         enable row level security;
alter table public.goal_contributions enable row level security;
alter table public.occasions          enable row level security;
alter table public.documents          enable row level security;
alter table public.contacts           enable row level security;
alter table public.tasks              enable row level security;
alter table public.shopping_lists     enable row level security;
alter table public.shopping_items     enable row level security;
alter table public.notifications      enable row level security;
alter table public.activity_log       enable row level security;

-- profiles: sadece kendi
drop policy if exists profiles_self on public.profiles;
create policy profiles_self on public.profiles
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- households: üye okur; yetişkin günceller; oluşturma RPC ile
drop policy if exists households_read on public.households;
create policy households_read on public.households
  for select using (public.is_household_member(id));
drop policy if exists households_update on public.households;
create policy households_update on public.households
  for update using (public.is_household_adult(id));

-- household_members
drop policy if exists hm_read on public.household_members;
create policy hm_read on public.household_members
  for select using (public.is_household_member(household_id));
drop policy if exists hm_write on public.household_members;
create policy hm_write on public.household_members
  for all using (public.is_household_adult(household_id))
  with check (public.is_household_adult(household_id));

-- fx_rates: herkes okur; yetişkin yazar (hane bağımsız ortak tablo)
drop policy if exists fx_read on public.fx_rates;
create policy fx_read on public.fx_rates for select using (auth.uid() is not null);
drop policy if exists fx_write on public.fx_rates;
create policy fx_write on public.fx_rates for insert with check (auth.uid() is not null);

-- Genel şablon: üye okur, yetişkin yazar
do $$
declare t text;
begin
  foreach t in array array[
    'accounts','categories','recurring_rules','plans','transactions','budgets',
    'plan_items','goal_contributions','occasions','documents','contacts'
  ] loop
    execute format('drop policy if exists %s_read on public.%I', t, t);
    execute format('create policy %s_read on public.%I for select
                    using (public.is_household_member(household_id))', t, t);
    execute format('drop policy if exists %s_write on public.%I', t, t);
    execute format('create policy %s_write on public.%I for all
                    using (public.is_household_adult(household_id))
                    with check (public.is_household_adult(household_id))', t, t);
  end loop;

  -- Takvim, görev, alışveriş: misafir de yazabilir (üye = yeter)
  foreach t in array array[
    'calendar_events','tasks','shopping_lists','shopping_items'
  ] loop
    execute format('drop policy if exists %s_all on public.%I', t, t);
    execute format('create policy %s_all on public.%I for all
                    using (public.is_household_member(household_id))
                    with check (public.is_household_member(household_id))', t, t);
  end loop;
end $$;

drop policy if exists ea_all on public.event_attendees;
create policy ea_all on public.event_attendees for all
  using (exists (select 1 from public.calendar_events e
                 where e.id = event_id and public.is_household_member(e.household_id)))
  with check (exists (select 1 from public.calendar_events e
                 where e.id = event_id and public.is_household_member(e.household_id)));

drop policy if exists notif_read on public.notifications;
create policy notif_read on public.notifications for select
  using (public.is_household_member(household_id)
         and (member_id is null or member_id = public.my_member_id(household_id)));
drop policy if exists notif_update on public.notifications;
create policy notif_update on public.notifications for update
  using (public.is_household_member(household_id));

drop policy if exists log_read on public.activity_log;
create policy log_read on public.activity_log for select
  using (public.is_household_adult(household_id));

-- ---------------------------------------------------------------------------
-- 12. RPC'ler
-- ---------------------------------------------------------------------------

-- Hane kur: hane + kurucu üye + varsayılan kategoriler + varsayılan hesap
create or replace function public.create_household(
  p_name text, p_base_currency char(3) default 'CLP',
  p_timezone text default 'America/Santiago', p_display_name text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare hid uuid; nm text;
begin
  if auth.uid() is null then raise exception 'giriş gerekli'; end if;
  insert into public.households (name, base_currency, timezone, created_by)
    values (p_name, p_base_currency, p_timezone, auth.uid()) returning id into hid;
  select coalesce(p_display_name, full_name, 'Ben') into nm from public.profiles where user_id = auth.uid();
  insert into public.household_members (household_id, user_id, display_name, role)
    values (hid, auth.uid(), coalesce(nm,'Ben'), 'adult');
  update public.profiles set default_household_id = hid where user_id = auth.uid();
  insert into public.accounts (household_id, name, type, currency, icon)
    values (hid, 'Nakit', 'cash', p_base_currency, '💵');
  perform public.seed_default_categories(hid);
  return hid;
end $$;

-- Koda katıl
create or replace function public.join_household(p_code text, p_display_name text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare hid uuid; nm text;
begin
  if auth.uid() is null then raise exception 'giriş gerekli'; end if;
  select id into hid from public.households where join_code = upper(trim(p_code));
  if hid is null then raise exception 'kod bulunamadı'; end if;
  select coalesce(p_display_name, full_name, 'Üye') into nm from public.profiles where user_id = auth.uid();
  insert into public.household_members (household_id, user_id, display_name, role)
    values (hid, auth.uid(), nm, 'adult')
    on conflict (household_id, user_id) do update set is_active = true;
  update public.profiles set default_household_id = coalesce(default_household_id, hid)
    where user_id = auth.uid();
  return hid;
end $$;

-- Varsayılan kategoriler
create or replace function public.seed_default_categories(hid uuid)
returns void language plpgsql security definer set search_path = public as $$
declare p uuid;
begin
  if exists (select 1 from public.categories where household_id = hid) then return; end if;

  insert into public.categories (household_id,name,kind,icon,is_fixed,sort_order) values (hid,'Ev','expense','🏠',true,1) returning id into p;
  insert into public.categories (household_id,parent_id,name,kind,icon,is_fixed) values
    (hid,p,'Kira / Konut kredisi','expense','🔑',true),(hid,p,'Aidat','expense','🏢',true),
    (hid,p,'Elektrik','expense','💡',true),(hid,p,'Su','expense','🚿',true),
    (hid,p,'Gaz','expense','🔥',true),(hid,p,'İnternet & Telefon','expense','📶',true),
    (hid,p,'Bakım & Tamir','expense','🔧',false);

  insert into public.categories (household_id,name,kind,icon,sort_order) values (hid,'Market','expense','🛒',2) returning id into p;
  insert into public.categories (household_id,parent_id,name,kind,icon) values
    (hid,p,'Gıda','expense','🥦'),(hid,p,'Temizlik','expense','🧼'),(hid,p,'Kişisel bakım','expense','🧴');

  insert into public.categories (household_id,name,kind,icon,sort_order) values (hid,'Ulaşım','expense','🚗',3) returning id into p;
  insert into public.categories (household_id,parent_id,name,kind,icon) values
    (hid,p,'Yakıt','expense','⛽'),(hid,p,'Toplu taşıma','expense','🚇'),(hid,p,'Taksi / Uber','expense','🚕'),
    (hid,p,'Araç bakım & sigorta','expense','🛠️'),(hid,p,'Otopark & TAG','expense','🅿️');

  insert into public.categories (household_id,name,kind,icon,sort_order) values (hid,'Çocuklar','expense','🧒',4) returning id into p;
  insert into public.categories (household_id,parent_id,name,kind,icon,is_fixed) values
    (hid,p,'Okul','expense','🎒',true),(hid,p,'Kurs & Aktivite','expense','🎨',false),
    (hid,p,'Giyim','expense','👕',false),(hid,p,'Harçlık','expense','🪙',false),(hid,p,'Oyuncak','expense','🧸',false);

  insert into public.categories (household_id,name,kind,icon,sort_order) values (hid,'Sağlık','expense','🩺',5) returning id into p;
  insert into public.categories (household_id,parent_id,name,kind,icon,is_fixed) values
    (hid,p,'Sigorta (Isapre/SGK)','expense','🛡️',true),(hid,p,'Doktor & Diş','expense','🦷',false),(hid,p,'Eczane','expense','💊',false);

  insert into public.categories (household_id,name,kind,icon,sort_order) values (hid,'Yeme-İçme','expense','🍽️',6) returning id into p;
  insert into public.categories (household_id,parent_id,name,kind,icon) values
    (hid,p,'Restoran','expense','🍝'),(hid,p,'Kafe','expense','☕'),(hid,p,'Sipariş','expense','🛵');

  insert into public.categories (household_id,name,kind,icon,sort_order) values (hid,'Eğlence & Sosyal','expense','🎉',7) returning id into p;
  insert into public.categories (household_id,parent_id,name,kind,icon,is_fixed) values
    (hid,p,'Abonelikler','expense','📺',true),(hid,p,'Etkinlik & Sinema','expense','🎬',false),
    (hid,p,'Hediye','expense','🎁',false),(hid,p,'Davet & Misafir','expense','🥂',false);

  insert into public.categories (household_id,name,kind,icon,sort_order) values (hid,'Seyahat','expense','✈️',8) returning id into p;
  insert into public.categories (household_id,parent_id,name,kind,icon) values
    (hid,p,'Uçak & Bilet','expense','🎫'),(hid,p,'Konaklama','expense','🏨'),(hid,p,'Seyahatte harcama','expense','🧳');

  insert into public.categories (household_id,name,kind,icon,sort_order) values (hid,'Giyim','expense','👗',9);
  insert into public.categories (household_id,name,kind,icon,sort_order) values (hid,'Eğitim & Kitap','expense','📚',10);
  insert into public.categories (household_id,name,kind,icon,sort_order) values (hid,'Evcil hayvan','expense','🐾',11);
  insert into public.categories (household_id,name,kind,icon,sort_order) values (hid,'Vergi & Resmi','expense','🏛️',12);
  insert into public.categories (household_id,name,kind,icon,sort_order) values (hid,'Diğer','expense','🏷️',99);

  insert into public.categories (household_id,name,kind,icon,sort_order) values
    (hid,'Maaş','income','💼',1),(hid,'Danışmanlık / Serbest','income','🧪',2),
    (hid,'Kira geliri','income','🏘️',3),(hid,'Temettü / Faiz','income','📈',4),
    (hid,'Hediye / Destek','income','🎁',5),(hid,'Diğer gelir','income','➕',99);
end $$;

-- Aylık özet (ana para biriminde)
create or replace function public.month_summary(hid uuid, p_period char(7))
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare d1 date; d2 date; res jsonb;
begin
  if not public.is_household_member(hid) then raise exception 'yetki yok'; end if;
  d1 := to_date(p_period || '-01', 'YYYY-MM-DD');
  d2 := (d1 + interval '1 month')::date;
  select jsonb_build_object(
    'period', p_period,
    'expense', coalesce(sum(amount_base) filter (where kind='expense'),0),
    'income',  coalesce(sum(amount_base) filter (where kind='income'),0),
    'by_category', (
      select coalesce(jsonb_agg(jsonb_build_object('category_id',c.id,'name',c.name,'icon',c.icon,'total',x.total)
                      order by x.total desc),'[]'::jsonb)
      from (select coalesce(pc.id, cc.id) as cid, sum(t.amount_base) total
              from public.transactions t
              left join public.categories cc on cc.id = t.category_id
              left join public.categories pc on pc.id = cc.parent_id
             where t.household_id = hid and t.kind='expense'
               and t.occurred_on >= d1 and t.occurred_on < d2
             group by 1) x
      left join public.categories c on c.id = x.cid),
    'by_member', (
      select coalesce(jsonb_agg(jsonb_build_object('member_id',m.id,'name',m.display_name,'total',x.total)),'[]'::jsonb)
      from (select for_member_id mid, sum(amount_base) total from public.transactions
             where household_id = hid and kind='expense' and occurred_on >= d1 and occurred_on < d2
             group by 1) x left join public.household_members m on m.id = x.mid)
  ) into res
  from public.transactions
  where household_id = hid and occurred_on >= d1 and occurred_on < d2;
  return coalesce(res, jsonb_build_object('period',p_period,'expense',0,'income',0,'by_category','[]'::jsonb,'by_member','[]'::jsonb));
end $$;

-- Bütçe durumu
create or replace function public.budget_status(hid uuid, p_period char(7))
returns table (category_id uuid, category_name text, icon text, budget numeric, spent numeric, remaining numeric, pct numeric)
language sql stable security definer set search_path = public as $$
  -- NOT: `from transactions t, d left join ...` yazılmaz — virgüllü birleştirmede
  -- sonraki LEFT JOIN `t`'ye değil `d`'ye bağlanır ve sorgu derlenmez.
  -- Bu yüzden dönem sınırları CTE yerine doğrudan ifade olarak yazılıyor.
  -- CTE adı `sp`: çıktı kolonu `spent` ile çakışmasın (RETURNS TABLE adları görünür).
  with sp as (
    select coalesce(pc.id, cc.id) cid, sum(t.amount_base) total
      from public.transactions t
      left join public.categories cc on cc.id = t.category_id
      left join public.categories pc on pc.id = cc.parent_id
     where t.household_id = hid and t.kind='expense'
       and t.occurred_on >= to_date(p_period||'-01','YYYY-MM-DD')
       and t.occurred_on <  to_date(p_period||'-01','YYYY-MM-DD') + interval '1 month'
     group by 1)
  select b.category_id, c.name, c.icon, b.amount_base,
         coalesce(s.total,0), b.amount_base - coalesce(s.total,0),
         case when b.amount_base > 0 then round(100*coalesce(s.total,0)/b.amount_base,1) else 0 end
    from public.budgets b
    left join public.categories c on c.id = b.category_id
    left join sp s on s.cid = b.category_id
   where b.household_id = hid and b.period = p_period
     and public.is_household_member(hid)
   order by 7 desc;
$$;

-- Yaklaşan ajanda: olaylar + önemli günler + vadeler + belge süreleri + görevler
create or replace function public.upcoming_agenda(hid uuid, p_from date default current_date, p_days int default 7)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare p_to date := p_from + p_days;
begin
  if not public.is_household_member(hid) then raise exception 'yetki yok'; end if;
  return jsonb_build_object(
    'events', (select coalesce(jsonb_agg(to_jsonb(e) order by e.starts_at),'[]'::jsonb)
                 from public.calendar_events e
                where e.household_id = hid
                  and ((e.rrule is null and e.starts_at::date between p_from and p_to)
                       or e.rrule is not null)),
    'occasions', (select coalesce(jsonb_agg(to_jsonb(o)),'[]'::jsonb) from public.occasions o
                   where o.household_id = hid
                     and make_date(extract(year from p_from)::int, o.month, o.day) between p_from and p_to),
    'bills', (select coalesce(jsonb_agg(to_jsonb(r) order by r.next_due_on),'[]'::jsonb) from public.recurring_rules r
               where r.household_id = hid and r.is_active and r.next_due_on between p_from and p_to),
    'documents', (select coalesce(jsonb_agg(to_jsonb(d) order by d.expires_on),'[]'::jsonb) from public.documents d
                   where d.household_id = hid and d.expires_on is not null
                     and d.expires_on <= p_from + d.remind_days),
    'tasks', (select coalesce(jsonb_agg(to_jsonb(t) order by t.due_on),'[]'::jsonb) from public.tasks t
               where t.household_id = hid and not t.is_done and (t.due_on is null or t.due_on <= p_to))
  );
end $$;

-- Vadesi gelen düzenli kuralları işle (pg_cron ile günlük çağrılır)
create or replace function public.post_due_recurring()
returns int language plpgsql security definer set search_path = public as $$
declare r record; n int := 0; nxt date;
begin
  for r in select * from public.recurring_rules
            where is_active and next_due_on <= current_date loop
    if r.auto_post and r.account_id is not null then
      insert into public.transactions (household_id, kind, account_id, amount, currency,
                                       occurred_on, category_id, merchant, recurring_id, note)
      values (r.household_id, r.kind, r.account_id, r.amount, r.currency,
              r.next_due_on, r.category_id, r.name, r.id, 'otomatik');
      n := n + 1;
    else
      insert into public.notifications (household_id, title, body, kind, entity_type, entity_id)
      values (r.household_id, r.name || ' vadesi geldi',
              r.amount::text || ' ' || r.currency, 'bill_due', 'recurring_rules', r.id);
    end if;
    -- Basit ilerletme: MONTHLY → +1 ay, WEEKLY → +1 hafta, YEARLY → +1 yıl, DAILY → +1 gün
    nxt := case
      when r.rrule ilike '%FREQ=WEEKLY%'  then r.next_due_on + interval '1 week'
      when r.rrule ilike '%FREQ=YEARLY%'  then r.next_due_on + interval '1 year'
      when r.rrule ilike '%FREQ=DAILY%'   then r.next_due_on + interval '1 day'
      else r.next_due_on + interval '1 month' end;
    update public.recurring_rules set next_due_on = nxt where id = r.id;
  end loop;
  return n;
end $$;

-- Hesap bakiyeleri (view)
-- security_invoker: view, sorguyu ÇAĞIRAN kullanıcının yetkisiyle çalışır; böylece
-- accounts/transactions üzerindeki RLS geçerli kalır. Olmazsa view sahibinin
-- yetkisiyle çalışır ve her hanenin bakiyesi giriş yapmış herkese görünür.
create or replace view public.account_balances
with (security_invoker = true) as
select a.id as account_id, a.household_id, a.name, a.type, a.currency, a.icon,
       a.opening_balance
       + coalesce(sum(case when t.kind='income' and t.account_id=a.id then t.amount
                           when t.kind='expense' and t.account_id=a.id then -t.amount
                           when t.kind='transfer' and t.account_id=a.id then -t.amount
                           when t.kind='transfer' and t.transfer_account_id=a.id then coalesce(t.transfer_amount, t.amount)
                           else 0 end),0) as balance
  from public.accounts a
  left join public.transactions t
    on t.household_id = a.household_id and (t.account_id = a.id or t.transfer_account_id = a.id)
 where not a.is_archived
 group by a.id;

-- ============================================================================
-- Son. Sonraki migration: 0002_storage.sql (fiş/belge bucket'ları) — Faz 2
-- ============================================================================
