-- 0024 — Akıllı öneriler: alışkanlıktan öğrenen iki kısa yol
--
-- İKİSİ DE ELLE KURULUM İSTEMİYOR. Kural 0019'la aynı: kullanıcı favori
-- işaretlemez, uygulama kullanıldıkça öğrenir. Veri azken öneri çıkmaz;
-- "bir kez yaptın" alışkanlık değildir, yanlış öneri hiç önerinin kötüsüdür.
--
-- 1) HARCAMA ÖNERİSİ — "Lider · ~40.000" tek dokunuşla, tutar hazır.
--    Son 120 günde aynı yer + aynı kategoride EN AZ İKİ harcama olmalı.
--    Puan yakın zamana ağırlık veriyor (45 günde e kat söner) ve bugünkü
--    haftanın günüyle aynı gün yapılan harcamaya 1,5 kat ekliyor: cumartesi
--    açınca cumartesi marketi üstte. Önerilen tutar ORTANCA: bir kez 120.000'lik
--    büyük alışveriş ortalamayı kaydırırdı, ortancayı kaydırmaz.
--    Otomatik işlenen düzenli giderler (kira, abonelik) hariç — onları zaten
--    kimse elle girmiyor.
--
-- 2) ALIŞVERİŞ "BİTMİŞ OLABİLİR" — süt 5 günde bir yazılıyorsa ve son
--    yazılışın üstünden 5 gün geçtiyse öneri. En az ÜÇ farklı günde yazılmış
--    olmalı (iki aralık), yoksa "ara" diye bir şey yok.
--    Kayıt, katalogdan eklenen her ürünün favori sayacı işlerken tutuluyor
--    (tetik); shopping_add_item fonksiyonuna dokunulmadı.

-- ---------------------------------------------------------------------------
-- 1) Harcama önerisi
create or replace function public.expense_suggestions(hid uuid, p_date date default current_date,
                                                      p_limit int default 4)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare res jsonb;
begin
  if not public.can_see_money(hid) then return '[]'::jsonb; end if;

  with son as (
    select lower(btrim(t.merchant)) as anahtar, btrim(t.merchant) as ad, t.category_id,
           t.amount, t.currency, t.occurred_on, t.account_id
      from public.transactions t
     where t.household_id = hid and t.kind = 'expense'
       and t.recurring_id is null
       and t.merchant is not null and btrim(t.merchant) <> ''
       and t.occurred_on between p_date - 120 and p_date
  ), grup as (
    select anahtar, category_id, currency,
           count(*) as adet,
           sum(exp(-(p_date - occurred_on) / 45.0)
               * case when extract(isodow from occurred_on) = extract(isodow from p_date) then 1.5 else 1 end) as puan,
           percentile_cont(0.5) within group (order by amount) as ortanca,
           max(occurred_on) as son_tarih,
           (array_agg(ad order by occurred_on desc))[1] as ad,
           (array_agg(account_id order by occurred_on desc))[1] as hesap
      from son
     group by anahtar, category_id, currency
    having count(*) >= 2
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'merchant', g.ad, 'category_id', g.category_id,
           'category_name', c.name, 'category_icon', c.icon,
           'currency', g.currency, 'account_id', g.hesap,
           -- Para kayan noktada tutulmaz: ortanca numeric'e çevrilip para
           -- biriminin ondalığına yuvarlanıyor (CLP tam sayı).
           'amount', round(g.ortanca::numeric, case when g.currency in ('CLP', 'JPY', 'KRW') then 0 else 2 end),
           'uses', g.adet, 'last_on', g.son_tarih)
         order by g.puan desc), '[]'::jsonb)
    into res
    from (select * from grup order by puan desc limit greatest(1, least(coalesce(p_limit, 4), 8))) g
    left join public.categories c on c.id = g.category_id;

  return res;
end $$;

revoke all on function public.expense_suggestions(uuid, date, int) from public, anon;
grant execute on function public.expense_suggestions(uuid, date, int) to authenticated;

-- ---------------------------------------------------------------------------
-- 2) Alışveriş yazılma günlüğü + "bitmiş olabilir"
create table if not exists public.shopping_add_log (
  household_id uuid not null references public.households(id) on delete cascade,
  catalog_key  text not null,
  added_on     date not null,
  primary key (household_id, catalog_key, added_on)
);
alter table public.shopping_add_log enable row level security;
drop policy if exists shlog_hane on public.shopping_add_log;
create policy shlog_hane on public.shopping_add_log for select
  using (public.is_household_member(household_id));
-- Yazma yalnızca tetikten (security definer); ekrandan doğrudan yazılmıyor.

create or replace function public.shopping_log_from_favorite()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.shopping_add_log (household_id, catalog_key, added_on)
  values (new.household_id, new.catalog_key, (new.last_used_at at time zone 'America/Santiago')::date)
  on conflict do nothing;
  return new;
end $$;

-- Yalnızca tetik çağırır; API üzerinden çağrılabilir durmasın.
revoke all on function public.shopping_log_from_favorite() from public, anon, authenticated;

drop trigger if exists shopping_favorites_log on public.shopping_favorites;
create trigger shopping_favorites_log
  after insert or update of uses on public.shopping_favorites
  for each row execute function public.shopping_log_from_favorite();

-- Geçmişten tohum: favori tablosunda her ürünün son yazılış günü biliniyor.
-- Tek gün öneri üretmeye yetmez ama öğrenme sıfırdan başlamasın.
insert into public.shopping_add_log (household_id, catalog_key, added_on)
select household_id, catalog_key, (last_used_at at time zone 'America/Santiago')::date
  from public.shopping_favorites
on conflict do nothing;

create or replace function public.restock_suggestions(hid uuid, p_date date default current_date,
                                                      p_limit int default 6)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare res jsonb;
begin
  if not public.is_household_member(hid) then raise exception 'yetki yok'; end if;

  with gunler as (
    select catalog_key, added_on,
           added_on - lag(added_on) over (partition by catalog_key order by added_on) as ara
      from public.shopping_add_log
     where household_id = hid and added_on between p_date - 180 and p_date
  ), ozet as (
    select catalog_key,
           count(*) as gun_sayisi,
           percentile_cont(0.5) within group (order by ara) filter (where ara is not null) as tipik_ara,
           max(added_on) as son
      from gunler
     group by catalog_key
    having count(*) >= 3
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'catalog_key', catalog_key,
           'every_days', round(tipik_ara::numeric),
           'days_since', p_date - son)
         order by (p_date - son) / greatest(tipik_ara, 1) desc), '[]'::jsonb)
    into res
    from (
      select * from ozet
       -- 2 günden sık yazılan şey (her gün ekmek) öneri gürültüsü olur;
       -- 60 günden seyrek olan için tahmin güvenilmez.
       where tipik_ara between 2 and 60
         and (p_date - son) >= tipik_ara * 0.9
       order by (p_date - son) / greatest(tipik_ara, 1) desc
       limit greatest(1, least(coalesce(p_limit, 6), 12))
    ) x;

  return res;
end $$;

revoke all on function public.restock_suggestions(uuid, date, int) from public, anon;
grant execute on function public.restock_suggestions(uuid, date, int) to authenticated;
