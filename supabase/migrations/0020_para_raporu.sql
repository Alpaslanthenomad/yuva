-- 0020 — Para raporu: çok aylık eğilim
--
-- NEDEN: Para ekranı tek ayı gösteriyordu; "geçen aya göre %" dışında hiçbir
-- geçmiş yoktu. Bir hanenin asıl sorusu tek ay değil: "her ay ne kadar
-- gidiyor, hangi kalem büyüyor?" Tek ay bunu söylemez — ocakta uçak bileti
-- alındıysa ocak yüksektir, bu bir eğilim değildir.
--
-- BOŞ AY DA DÖNER. generate_series ile pencerenin her ayı üretiliyor, işlem
-- olmasa bile sıfırla. Yoksa grafik boş ayları atlar ve iki dolu ay yan yana
-- gelir; bakan kişi kesintisiz bir artış görür — yalan söyleyen grafik.
--
-- PENCERE SON AYDA BİTER, p_period'da. İleri aya bakarken ("›" ile gelecek ay)
-- rapor da o ayda biter; ekranın geri kalanıyla aynı ayı konuşur.
--
-- KATEGORİ ÜST KATEGORİDE TOPLANIR (month_summary ile aynı kural): "Market"
-- altındaki 6 alt kalem ayrı ayrı değil tek çubuk. 12 kategorilik bir liste
-- okunur, 52'lik liste okunmaz.
--
-- YETKİ: month_summary ile aynı — can_see_money. Rapor tek ayın toplamından
-- daha çok şey söyler; para görmeyen üye burayı da görmemeli.
--
-- KUR: her zaman amount_base. Katkı/işlem anında donmuş taban tutar (0006);
-- bugünkü kurla yeniden çevirmek geçmiş ayları her gün değiştirirdi.

create or replace function public.month_trend(hid uuid, p_period char(7), p_months int default 6)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_n     int;
  v_last  date;   -- pencerenin son ayının ilk günü
  v_first date;   -- pencerenin ilk ayının ilk günü
  v_end   date;   -- pencerenin bitişi (dışlayan)
  res     jsonb;
begin
  if not public.can_see_money(hid) then raise exception 'yetki yok'; end if;

  -- 1..24 arası. Üst sınır keyfi değil: iki yıl bir telefon ekranında
  -- okunabilecek en uzun çubuk dizisi, altı da sorgunun maliyeti.
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
  ),
  -- Ay başına toplamlar. left join: işlemi olmayan ay da satır üretir.
  aylik as (
    select a.period,
           coalesce(sum(i.amount_base) filter (where i.kind = 'income'),  0) as income,
           coalesce(sum(i.amount_base) filter (where i.kind = 'expense'), 0) as expense,
           coalesce(sum(i.amount_base) filter (where i.kind = 'expense' and i.sabit), 0) as fixed
      from aylar a
      left join islem i on i.occurred_on >= a.d1 and i.occurred_on < a.d2
     group by a.period
  ),
  -- Pencere boyunca en çok harcanan kategoriler (üst kategoride toplanmış).
  kat_toplam as (
    select cid, sum(amount_base) as total
      from islem where kind = 'expense' and cid is not null
     group by cid
     order by 2 desc
     limit 8
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

revoke all on function public.month_trend(uuid, char, int) from public, anon;
grant execute on function public.month_trend(uuid, char, int) to authenticated;
