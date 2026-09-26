-- 0029 — Aile limitleri her ay kendini tekrarlar; eşin kişisel harcamasının
--        ayrıntısı gizli, tutarı görünür.
--
-- 1) LİMİT TAŞIMA
--    İSTEK: "Aile limiti her ay kendini tekrarlasın; geçen ayın limitleri yeni
--    aya kendiliğinden taşınmalı."
--    MODEL: budgets satırı artık "bu aydan itibaren geçerli" demek. Bir ayın
--    limiti = o kategori için dönemi <= o ay olan EN SON satır. Tutar 0 olan
--    satır "bu aydan itibaren kaldırıldı" işaretidir (taşınmaz).
--      • budget_set(ay, kat, tutar): o aya yazar ve SONRAKİ aylardaki aynı
--        kategori satırlarını siler — "bundan sonra böyle" anlamında.
--      • budget_remove(ay, kat): o ay ve sonrasını siler; daha eski bir satır
--        hâlâ taşınacaksa o aya 0 işareti koyar. Geçmiş aylar dokunulmaz.
--    Yeni satır yazılmadan, sorgu anında taşınır: ay dönünce kimsenin bir şey
--    yapması gerekmez, cron da yok.
--
-- 2) KİŞİSEL HARCAMA GİZLİLİĞİ
--    KARAR (kullanıcı, 2026-09-25): eşin kişisel harcaması İşlemler'de
--    "Kişisel harcama · tutar" olarak görünsün; nereye, kategori, not gizli.
--    Sınır ekranda değil burada: başkasının kişisel satırı RLS ile istemciye
--    hiç gelmez. Maskeli hali (tarih, tutar, hesap, kimin) yalnızca
--    personal_masked() ile gelir. Hesap bakiyeleri herkesin harcamasını
--    saymaya devam eder (account_balances tanımlayıcı-haklı fonksiyondan).

-- ---------------------------------------------------------------------------
-- 1. Limit taşıma
-- ---------------------------------------------------------------------------
create or replace function public.budget_set(hid uuid, p_period character, p_category_id uuid, p_amount numeric)
returns public.budgets language plpgsql security definer set search_path = public as $$
declare out_row public.budgets;
begin
  if not public.is_household_adult(hid) then raise exception 'yetki yok'; end if;
  if coalesce(p_amount, 0) <= 0 then raise exception 'tutar pozitif olmalı'; end if;

  -- "Bundan sonra böyle": ileri aylardaki eski ayarlar geçersiz.
  delete from public.budgets
   where household_id = hid and period > p_period
     and category_id is not distinct from p_category_id;

  update public.budgets
     set amount_base = p_amount, updated_at = now()
   where household_id = hid and period = p_period
     and category_id is not distinct from p_category_id
  returning * into out_row;

  if not found then
    insert into public.budgets (household_id, period, category_id, amount_base)
    values (hid, p_period, p_category_id, p_amount)
    returning * into out_row;
  end if;
  return out_row;
end $$;

create or replace function public.budget_remove(hid uuid, p_period character, p_category_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_household_adult(hid) then raise exception 'yetki yok'; end if;
  delete from public.budgets
   where household_id = hid and period >= p_period
     and category_id is not distinct from p_category_id;
  -- Daha eski bir ayar varsa bu aydan itibaren taşınmasın.
  if exists (select 1 from public.budgets
              where household_id = hid and period < p_period
                and category_id is not distinct from p_category_id) then
    insert into public.budgets (household_id, period, category_id, amount_base)
    values (hid, p_period, p_category_id, 0);
  end if;
end $$;

-- Dönüş tipine 'from_period' eklendiği için yeniden kuruluyor.
drop function if exists public.budget_status(uuid, character);
create function public.budget_status(hid uuid, p_period character)
returns table(category_id uuid, category_name text, icon text, budget numeric, spent numeric,
              remaining numeric, pct numeric, from_period character)
language sql stable security definer set search_path = public as $$
  with gecerli as (
    select distinct on (b.category_id) b.category_id, b.amount_base, b.period
      from public.budgets b
     where b.household_id = hid and b.period <= p_period
     order by b.category_id, b.period desc
  ),
  sp as (
    select coalesce(pc.id, cc.id) cid, sum(t.amount_base) total
      from public.transactions t
      left join public.categories cc on cc.id = t.category_id
      left join public.categories pc on pc.id = cc.parent_id
     where t.household_id = hid and t.kind = 'expense' and t.for_member_id is null
       and t.occurred_on >= to_date(p_period||'-01','YYYY-MM-DD')
       and t.occurred_on <  to_date(p_period||'-01','YYYY-MM-DD') + interval '1 month'
     group by 1),
  tot as (
    select coalesce(sum(t.amount_base), 0) total
      from public.transactions t
     where t.household_id = hid and t.kind = 'expense' and t.for_member_id is null
       and t.occurred_on >= to_date(p_period||'-01','YYYY-MM-DD')
       and t.occurred_on <  to_date(p_period||'-01','YYYY-MM-DD') + interval '1 month')
  select g.category_id, c.name, c.icon, g.amount_base,
         s.spent,
         g.amount_base - s.spent,
         case when g.amount_base > 0 then round(100 * s.spent / g.amount_base, 1) else 0 end,
         g.period
    from gecerli g
    left join public.categories c on c.id = g.category_id
    cross join lateral (
      select case when g.category_id is null
                  then (select total from tot)
                  else coalesce((select sp.total from sp where sp.cid = g.category_id), 0)
             end as spent
    ) s
   where g.amount_base > 0
     and public.can_see_money(hid)
   order by (g.category_id is not null), 7 desc;
$$;

revoke all on function public.budget_status(uuid, character)          from public, anon;
revoke all on function public.budget_remove(uuid, character, uuid)    from public, anon;
grant execute on function public.budget_status(uuid, character)       to authenticated;
grant execute on function public.budget_remove(uuid, character, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Kişisel harcama gizliliği
-- ---------------------------------------------------------------------------
-- Satır başkasının kişisel harcaması mı? (Benimki ya da aileninki değilse.)
create or replace function public.baskasinin_kisiseli(hid uuid, fm uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select fm is not null and fm is distinct from public.my_member_id(hid);
$$;

drop policy if exists transactions_read   on public.transactions;
drop policy if exists transactions_write  on public.transactions;
drop policy if exists transactions_insert on public.transactions;
drop policy if exists transactions_update on public.transactions;
drop policy if exists transactions_delete on public.transactions;

create policy transactions_read on public.transactions for select
  using (public.can_see_money(household_id) and not public.baskasinin_kisiseli(household_id, for_member_id));
create policy transactions_insert on public.transactions for insert
  with check (public.is_household_adult(household_id));
create policy transactions_update on public.transactions for update
  using (public.is_household_adult(household_id) and not public.baskasinin_kisiseli(household_id, for_member_id))
  with check (public.is_household_adult(household_id));
create policy transactions_delete on public.transactions for delete
  using (public.is_household_adult(household_id) and not public.baskasinin_kisiseli(household_id, for_member_id));

-- Etkinlik kaydı başkasının kişisel harcamasının ayrıntısını sızdırmasın.
drop policy if exists log_read on public.activity_log;
create policy log_read on public.activity_log for select
  using (public.is_household_adult(household_id)
         and not (table_name = 'transactions'
                  and public.baskasinin_kisiseli(household_id,
                        coalesce(new_row->>'for_member_id', old_row->>'for_member_id')::uuid)));

-- Maskeli liste: yalnızca tarih, tutar, hesap ve kimin olduğu.
create or replace function public.personal_masked(hid uuid, p_from date default null, p_to date default null)
returns table(id uuid, kind public.txn_kind, account_id uuid, amount numeric, currency character,
              amount_base numeric, occurred_on date, for_member_id uuid, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select t.id, t.kind, t.account_id, t.amount, t.currency, t.amount_base, t.occurred_on,
         t.for_member_id, t.created_at
    from public.transactions t
   where t.household_id = hid
     and public.can_see_money(hid)
     and public.baskasinin_kisiseli(hid, t.for_member_id)
     and (p_from is null or t.occurred_on >= p_from)
     and (p_to   is null or t.occurred_on <  p_to)
   order by t.occurred_on desc, t.created_at desc
   limit 500;
$$;
revoke all on function public.personal_masked(uuid, date, date) from public, anon;
grant execute on function public.personal_masked(uuid, date, date) to authenticated;

-- Bakiyeler herkesin harcamasını saymalı; görünüm artık RLS'ten bağımsız
-- bir fonksiyondan okuyor (yetki: can_see_money).
create or replace function public.account_balances_calc()
returns table(account_id uuid, household_id uuid, name text, type public.account_type,
              currency character(3), icon text, balance numeric)
language sql stable security definer set search_path = public as $$
  select a.id, a.household_id, a.name, a.type, a.currency, a.icon,
         a.opening_balance + coalesce(sum(case
           when t.kind = 'income'   and t.account_id = a.id then t.amount
           when t.kind = 'expense'  and t.account_id = a.id then -t.amount
           when t.kind = 'transfer' and t.account_id = a.id then -t.amount
           when t.kind = 'transfer' and t.transfer_account_id = a.id then coalesce(t.transfer_amount, t.amount)
           else 0 end), 0)
    from public.accounts a
    left join public.transactions t
           on t.household_id = a.household_id and (t.account_id = a.id or t.transfer_account_id = a.id)
   where not a.is_archived and public.can_see_money(a.household_id)
   group by a.id;
$$;
revoke all on function public.account_balances_calc() from public, anon;
grant execute on function public.account_balances_calc() to authenticated;

drop view if exists public.account_balances;
create view public.account_balances with (security_invoker = true) as
  select * from public.account_balances_calc();
revoke all on public.account_balances from anon;
grant select on public.account_balances to authenticated;

-- Güvenlik denetimi: giriş yapmamış (anon) rol bu ikisini çağıramasın.
revoke all on function public.baskasinin_kisiseli(uuid, uuid) from public, anon;
grant execute on function public.baskasinin_kisiseli(uuid, uuid) to authenticated;
revoke all on function public.budget_set(uuid, character, uuid, numeric) from public, anon;
grant execute on function public.budget_set(uuid, character, uuid, numeric) to authenticated;
