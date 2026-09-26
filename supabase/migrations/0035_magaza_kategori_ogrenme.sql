-- 0035 — Mağazadan kategori öğrenme
--
-- İSTEK (öneri 1): "Bir yeri bir kez kategorilediğinde uygulama bunu
-- hatırlasın: 'Jumbo' yazınca kategori kendiliğinden Market olsun."
--
-- Kural tablosu YOK: son 12 aydaki kendi harcamalarından, her mağaza için en
-- sık kullanılan kategori. Böylece kategoriyi düzelttiğinde (ya da
-- kategorisizleri doldurduğunda) öğrenilen de kendiliğinden düzelir.
--
-- ÇAĞIRANIN HAKLARIYLA çalışır (security invoker): işlem tablosunun kuralı
-- geçerli, yani eşin kişisel harcamasının mağaza adı buradan sızmaz (0029).

create or replace function public.merchant_categories(hid uuid, p_limit int default 300)
returns table(merchant text, category_id uuid, uses int, last_on date)
language sql stable security invoker set search_path = public as $$
  with t as (
    select lower(btrim(regexp_replace(tr.merchant, '\s+', ' ', 'g'))) as k,
           tr.merchant, tr.category_id, tr.occurred_on, tr.created_at
      from public.transactions tr
     where tr.household_id = hid and tr.kind = 'expense'
       and tr.merchant is not null and btrim(tr.merchant) <> ''
       and tr.category_id is not null
       and tr.occurred_on >= current_date - 365
  ),
  sayim as (select k, category_id, count(*) as n, max(occurred_on) as son from t group by k, category_id),
  en_cok as (select distinct on (k) k, category_id, n, son from sayim order by k, n desc, son desc),
  ad as (select distinct on (k) k, merchant from t order by k, occurred_on desc, created_at desc)
  select ad.merchant, en_cok.category_id, en_cok.n::int, en_cok.son
    from en_cok join ad using (k)
   order by en_cok.n desc, en_cok.son desc
   limit least(greatest(coalesce(p_limit, 300), 1), 1000);
$$;
revoke all on function public.merchant_categories(uuid, int) from public, anon;
grant execute on function public.merchant_categories(uuid, int) to authenticated;
