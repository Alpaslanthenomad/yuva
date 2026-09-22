-- 0006 — Para tarafındaki hesaplama hataları
-- Bulgular kod incelemesiyle doğrulandı (2026-09-21):
--  1. Toplam bütçe satırı (category_id IS NULL) harcamayı her zaman 0 gösteriyordu.
--  2. Aynı döneme birden fazla "toplam bütçe" satırı girilebiliyordu.
--  3. month_summary `fixed` / `variable` döndürmüyordu; Para ekranı sabit gideri
--     hep 0, değişkeni de toplam gider olarak gösteriyordu.
--  4. goal_contributions'ta dondurulmuş kur yoktu; ön yüz güncel kurla hesaplıyordu.
-- Migration idempotenttir.

-- ---------------------------------------------------------------------------
-- 1. Toplam bütçe tekilliği
-- ---------------------------------------------------------------------------
-- Postgres'te UNIQUE kısıtında NULL'lar birbirinden farklı sayılır; bu yüzden
-- (household_id, period, NULL) satırı defalarca eklenebiliyordu. Önce mevcut
-- fazlalıkları temizle (en son güncellenen kalır), sonra kısmi tekil indeks kur.
delete from public.budgets b
 using public.budgets b2
 where b.category_id is null
   and b2.category_id is null
   and b.household_id = b2.household_id
   and b.period = b2.period
   and (b.updated_at, b.id) < (b2.updated_at, b2.id);

create unique index if not exists budgets_total_uniq
  on public.budgets (household_id, period)
  where category_id is null;

-- ---------------------------------------------------------------------------
-- 2. budget_status — toplam bütçe satırı artık dönemin tüm giderini görüyor
-- ---------------------------------------------------------------------------
create or replace function public.budget_status(hid uuid, p_period char(7))
returns table (category_id uuid, category_name text, icon text, budget numeric, spent numeric, remaining numeric, pct numeric)
language sql stable security definer set search_path = public as $$
  -- sp: kategori kırılımı (alt kategori üst kategoriye toplanır)
  -- tot: dönemin toplam gideri — kategorisiz (toplam) bütçe satırı bunu kullanır
  with sp as (
    select coalesce(pc.id, cc.id) cid, sum(t.amount_base) total
      from public.transactions t
      left join public.categories cc on cc.id = t.category_id
      left join public.categories pc on pc.id = cc.parent_id
     where t.household_id = hid and t.kind = 'expense'
       and t.occurred_on >= to_date(p_period||'-01','YYYY-MM-DD')
       and t.occurred_on <  to_date(p_period||'-01','YYYY-MM-DD') + interval '1 month'
     group by 1),
  tot as (
    select coalesce(sum(t.amount_base), 0) total
      from public.transactions t
     where t.household_id = hid and t.kind = 'expense'
       and t.occurred_on >= to_date(p_period||'-01','YYYY-MM-DD')
       and t.occurred_on <  to_date(p_period||'-01','YYYY-MM-DD') + interval '1 month')
  select b.category_id, c.name, c.icon, b.amount_base,
         s.spent,
         b.amount_base - s.spent,
         case when b.amount_base > 0 then round(100 * s.spent / b.amount_base, 1) else 0 end
    from public.budgets b
    left join public.categories c on c.id = b.category_id
    cross join lateral (
      select case when b.category_id is null
                  then (select total from tot)
                  else coalesce((select sp.total from sp where sp.cid = b.category_id), 0)
             end as spent
    ) s
   where b.household_id = hid and b.period = p_period
     and public.is_household_member(hid)
   -- toplam bütçe en üstte, sonra doluluk oranına göre
   order by (b.category_id is not null), 7 desc;
$$;

-- ---------------------------------------------------------------------------
-- 3. month_summary — sabit / değişken gider ayrımı
-- ---------------------------------------------------------------------------
-- Sabit gider tanımı demo modla aynı: kategorinin ya da üst kategorisinin
-- is_fixed alanı true ise (kira, abonelik gibi).
create or replace function public.month_summary(hid uuid, p_period char(7))
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare d1 date; d2 date; v_expense numeric; v_income numeric; v_fixed numeric; res jsonb;
begin
  if not public.is_household_member(hid) then raise exception 'yetki yok'; end if;
  d1 := to_date(p_period || '-01', 'YYYY-MM-DD');
  d2 := (d1 + interval '1 month')::date;

  select coalesce(sum(amount_base) filter (where kind = 'expense'), 0),
         coalesce(sum(amount_base) filter (where kind = 'income'), 0)
    into v_expense, v_income
    from public.transactions
   where household_id = hid and occurred_on >= d1 and occurred_on < d2;

  select coalesce(sum(t.amount_base), 0) into v_fixed
    from public.transactions t
    left join public.categories cc on cc.id = t.category_id
    left join public.categories pc on pc.id = cc.parent_id
   where t.household_id = hid and t.kind = 'expense'
     and t.occurred_on >= d1 and t.occurred_on < d2
     and (coalesce(cc.is_fixed, false) or coalesce(pc.is_fixed, false));

  res := jsonb_build_object(
    'period', p_period,
    'expense', v_expense,
    'income', v_income,
    'fixed', v_fixed,
    'variable', v_expense - v_fixed,
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
  );
  return res;
end $$;

-- ---------------------------------------------------------------------------
-- 4. goal_contributions — kur işlem anında dondurulur
-- ---------------------------------------------------------------------------
alter table public.goal_contributions add column if not exists fx_rate numeric(18,8);
alter table public.goal_contributions add column if not exists amount_base numeric(14,2);

create or replace function public.goal_contributions_compute_base()
returns trigger language plpgsql security definer set search_path = public as $$
declare base_ccy char(3); r numeric;
begin
  select base_currency into base_ccy from public.households where id = new.household_id;
  if tg_op = 'UPDATE'
     and new.amount = old.amount and new.currency = old.currency
     and new.on_date = old.on_date and old.amount_base is not null then
    new.fx_rate := old.fx_rate; new.amount_base := old.amount_base;
    return new;
  end if;
  r := public.fx_lookup(new.currency, base_ccy, new.on_date);
  if r is null then
    raise exception 'fx_rates: % → % için % tarihinde kur yok', new.currency, base_ccy, new.on_date;
  end if;
  new.fx_rate := r;
  new.amount_base := round(new.amount * r, 2);
  return new;
end $$;

drop trigger if exists trg_goal_contrib_compute_base on public.goal_contributions;
create trigger trg_goal_contrib_compute_base
  before insert or update on public.goal_contributions
  for each row execute function public.goal_contributions_compute_base();

-- Mevcut kayıtları doldur (kuru bulunamayanlar null kalır, ön yüz tutarı gösterir)
update public.goal_contributions g
   set fx_rate = public.fx_lookup(g.currency, h.base_currency, g.on_date),
       amount_base = round(g.amount * public.fx_lookup(g.currency, h.base_currency, g.on_date), 2)
  from public.households h
 where h.id = g.household_id
   and g.amount_base is null
   and public.fx_lookup(g.currency, h.base_currency, g.on_date) is not null;

-- ---------------------------------------------------------------------------
-- 5. budget_set — kategorisiz (toplam) bütçe için güvenli upsert
-- ---------------------------------------------------------------------------
-- PostgREST upsert'i ON CONFLICT (household_id, period, category_id) kullanıyor;
-- category_id NULL olduğunda bu çakışma hiçbir zaman eşleşmiyor ve mükerrer satır
-- oluşuyordu. Yetki kontrolü de burada yapılır: bütçeyi yalnızca yetişkin değiştirir.
create or replace function public.budget_set(hid uuid, p_period char(7), p_category_id uuid, p_amount numeric)
returns public.budgets language plpgsql security definer set search_path = public as $$
declare out_row public.budgets;
begin
  if not public.is_household_adult(hid) then raise exception 'yetki yok'; end if;

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
