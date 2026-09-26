-- 0027 — Aile bütçesi ve kişisel bütçe ayrıldı
--
-- İSTEK: "Üyeye göre kısmını kaldır; bu harcamalar aile ile birlikte, aile
-- için yapıldı. Kişisel harcamalar için ayrı bir bütçe oluşturalım. Aile için
-- yapılıyorsa belirtmeye gerek yok; kişisel ise harcama girilirken bir
-- tıkla ifade edilebilsin. Bu da rapora yansısın."
--
-- KURAL: harcama varsayılan olarak AİLENİN. transactions.for_member_id dolu
-- ise o kişinin KİŞİSEL harcamasıdır. Yeni sütun yok; alan zaten vardı
-- ("Kim için"), ama ekranda kimse doldurmuyordu ve rapor onu "üyeye göre"
-- diye ayrı bir kutuda gösteriyordu.
--
-- Bundan sonra:
--   • Aile özeti, kategori dağılımı, aile limitleri (budgets) ve rapor
--     YALNIZCA aile harcamasını sayar. Kişisel harcama aile limitini yemez.
--   • Kişisel harcama, sahibinin kendi limitiyle (personal_limits) izlenir.
--     Limit kişiye özel ve aylık; her ay yeniden girilmez.
--   • Gelir hanenindir; aile özetinde durur.
--   • 'total_expense' ikisinin toplamı — nakit akışı sorusu için.

create table if not exists public.personal_limits (
  member_id    uuid primary key references public.household_members(id) on delete cascade,
  household_id uuid not null references public.households(id) on delete cascade,
  amount_base  numeric(14,2) not null check (amount_base > 0),
  updated_at   timestamptz not null default now()
);
alter table public.personal_limits enable row level security;
drop policy if exists personal_limits_kendi on public.personal_limits;
create policy personal_limits_kendi on public.personal_limits for select
  using (member_id in (select id from public.household_members where user_id = auth.uid() and is_active));

create or replace function public.personal_limit_set(hid uuid, p_amount numeric)
returns void language plpgsql security definer set search_path = public as $$
declare mid uuid;
begin
  if not public.can_see_money(hid) then raise exception 'yetki yok'; end if;
  mid := public.my_member_id(hid);
  if coalesce(p_amount, 0) <= 0 then
    delete from public.personal_limits where member_id = mid;
    return;
  end if;
  insert into public.personal_limits (member_id, household_id, amount_base) values (mid, hid, p_amount)
  on conflict (member_id) do update set amount_base = excluded.amount_base, updated_at = now();
end $$;

create or replace function public.month_summary(hid uuid, p_period character)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare d1 date; d2 date; mid uuid;
        v_family numeric; v_income numeric; v_all numeric; v_fixed numeric; v_mine numeric; v_limit numeric;
begin
  if not public.can_see_money(hid) then raise exception 'yetki yok'; end if;
  d1 := to_date(p_period || '-01', 'YYYY-MM-DD');
  d2 := (d1 + interval '1 month')::date;
  mid := public.my_member_id(hid);

  select coalesce(sum(amount_base) filter (where kind = 'expense' and for_member_id is null), 0),
         coalesce(sum(amount_base) filter (where kind = 'expense'), 0),
         coalesce(sum(amount_base) filter (where kind = 'income'), 0),
         coalesce(sum(amount_base) filter (where kind = 'expense' and for_member_id = mid), 0)
    into v_family, v_all, v_income, v_mine
    from public.transactions
   where household_id = hid and occurred_on >= d1 and occurred_on < d2;

  select coalesce(sum(t.amount_base), 0) into v_fixed
    from public.transactions t
    left join public.categories cc on cc.id = t.category_id
    left join public.categories pc on pc.id = cc.parent_id
   where t.household_id = hid and t.kind = 'expense' and t.for_member_id is null
     and t.occurred_on >= d1 and t.occurred_on < d2
     and (coalesce(cc.is_fixed, false) or coalesce(pc.is_fixed, false));

  select amount_base into v_limit from public.personal_limits where member_id = mid;

  return jsonb_build_object(
    'period', p_period,
    'expense', v_family,            -- aile harcaması
    'total_expense', v_all,         -- aile + herkesin kişiseli
    'income', v_income,
    'fixed', v_fixed,
    'variable', v_family - v_fixed,
    'by_category', (
      select coalesce(jsonb_agg(jsonb_build_object('category_id', c.id, 'name', c.name, 'icon', c.icon, 'total', x.total)
                      order by x.total desc), '[]'::jsonb)
        from (select coalesce(pc.id, cc.id) as cid, sum(t.amount_base) total
                from public.transactions t
                left join public.categories cc on cc.id = t.category_id
                left join public.categories pc on pc.id = cc.parent_id
               where t.household_id = hid and t.kind = 'expense' and t.for_member_id is null
                 and t.occurred_on >= d1 and t.occurred_on < d2
               group by 1) x
        left join public.categories c on c.id = x.cid),
    -- Yalnızca BENİM kişisel harcamam; eşinki onun ekranında.
    'personal', jsonb_build_object(
      'total', v_mine,
      'limit', v_limit,
      'by_category', (
        select coalesce(jsonb_agg(jsonb_build_object('category_id', c.id, 'name', c.name, 'icon', c.icon, 'total', x.total)
                        order by x.total desc), '[]'::jsonb)
          from (select coalesce(pc.id, cc.id) as cid, sum(t.amount_base) total
                  from public.transactions t
                  left join public.categories cc on cc.id = t.category_id
                  left join public.categories pc on pc.id = cc.parent_id
                 where t.household_id = hid and t.kind = 'expense' and t.for_member_id = mid
                   and t.occurred_on >= d1 and t.occurred_on < d2
                 group by 1) x
          left join public.categories c on c.id = x.cid))
  );
end $$;

-- Aile limitleri yalnızca aile harcamasını sayar.
create or replace function public.budget_status(hid uuid, p_period character)
returns table(category_id uuid, category_name text, icon text, budget numeric, spent numeric, remaining numeric, pct numeric)
language sql stable security definer set search_path = public as $$
  with sp as (
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
     and public.can_see_money(hid)
   order by (b.category_id is not null), 7 desc;
$$;

-- Rapor: kapsam seçilebiliyor. 'family' (varsayılan) aile harcaması + hane
-- geliri; 'personal' yalnızca benim kişisel harcamam (gelir yok).
-- Eski üç parametreli sürüm kaldırılıyor ki çağrı iki aday arasında kalmasın.
drop function if exists public.month_trend(uuid, character, integer);
create or replace function public.month_trend(hid uuid, p_period character, p_months integer default 6,
                                              p_scope text default 'family')
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_n int; v_last date; v_first date; v_end date; mid uuid; res jsonb;
begin
  if not public.can_see_money(hid) then raise exception 'yetki yok'; end if;
  mid     := public.my_member_id(hid);
  v_n     := least(greatest(coalesce(p_months, 6), 1), 24);
  v_last  := to_date(p_period || '-01', 'YYYY-MM-DD');
  v_first := (v_last - make_interval(months => v_n - 1))::date;
  v_end   := (v_last + interval '1 month')::date;

  with aylar as (
    select to_char(g, 'YYYY-MM') as period, g::date as d1, (g + interval '1 month')::date as d2
      from generate_series(v_first, v_last, interval '1 month') g
  ),
  islem as (
    select t.id, t.kind, t.amount_base, t.occurred_on,
           coalesce(pc.id, cc.id) as cid,
           coalesce(cc.is_fixed, false) or coalesce(pc.is_fixed, false) as sabit
      from public.transactions t
      left join public.categories cc on cc.id = t.category_id
      left join public.categories pc on pc.id = cc.parent_id
     where t.household_id = hid
       and t.occurred_on >= v_first and t.occurred_on < v_end
       and case when p_scope = 'personal'
                then t.kind = 'expense' and t.for_member_id = mid
                else t.kind = 'income' or (t.kind = 'expense' and t.for_member_id is null) end
  ),
  aylik as (
    select a.period,
           coalesce(sum(i.amount_base) filter (where i.kind = 'income'),  0) as income,
           coalesce(sum(i.amount_base) filter (where i.kind = 'expense'), 0) as expense,
           coalesce(sum(i.amount_base) filter (where i.kind = 'expense' and i.sabit), 0) as fixed
      from aylar a
      left join islem i on i.occurred_on >= a.d1 and i.occurred_on < a.d2
     group by a.period
  ),
  kat_toplam as (
    select cid, sum(amount_base) as total
      from islem where kind = 'expense' and cid is not null
     group by cid order by 2 desc limit 8
  ),
  kat_aylik as (
    select i.cid, a.period, coalesce(sum(i2.amount_base), 0) as total
      from kat_toplam i
      cross join aylar a
      left join islem i2 on i2.cid = i.cid and i2.kind = 'expense'
                        and i2.occurred_on >= a.d1 and i2.occurred_on < a.d2
     group by i.cid, a.period
  )
  select jsonb_build_object(
    'scope', coalesce(p_scope, 'family'),
    'from', to_char(v_first, 'YYYY-MM'),
    'to',   p_period,
    'months', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'period', period, 'income', income, 'expense', expense,
               'fixed', fixed, 'variable', expense - fixed,
               'net', income - expense) order by period), '[]'::jsonb)
        from aylik),
    'categories', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'category_id', c.id, 'name', c.name, 'icon', c.icon,
               'total', k.total,
               'by_month', (select coalesce(jsonb_object_agg(ka.period, ka.total), '{}'::jsonb)
                              from kat_aylik ka where ka.cid = k.cid)
             ) order by k.total desc), '[]'::jsonb)
        from kat_toplam k left join public.categories c on c.id = k.cid)
  ) into res;
  return res;
end $$;

revoke all on function public.personal_limit_set(uuid, numeric)              from public, anon;
revoke all on function public.month_trend(uuid, character, integer, text)    from public, anon;
grant execute on function public.personal_limit_set(uuid, numeric)            to authenticated;
grant execute on function public.month_trend(uuid, character, integer, text)  to authenticated;
