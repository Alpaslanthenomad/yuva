-- 0019 — Alışveriş favorileri (kullandıkça öğrenen)
--
-- Hızlı seçimde 85 ürün var ve her hane bunların hep aynı 15-20 tanesini
-- alıyor. Her seferinde reyon gezmek gereksiz.
--
-- FAVORİ ELLE İŞARETLENMİYOR, SAYILIYOR. Gerekçe: elle yıldızlama bir kurulum
-- işidir, kimse yapmaz; ilk haftadan sonra liste yanlış kalır. Sayaç ise
-- kendiliğinden doğrulanıyor — yazın karpuz, kışın çorbalık yukarı çıkar.
--
-- Sayaç ürün EKLENİRKEN artar, satın alınırken değil: alışveriş harcamaya
-- çevrilince kalemler siliniyor (0016), yani satın alma anını yakalamak için
-- ayrı bir kayıt gerekirdi. "Listeye yazdım" niyeti zaten doğru ölçü.
--
-- Anahtar olarak katalog anahtarı (ör. 'tomato') tutuluyor, ad değil: hane
-- dilini değiştirse de sayaç taşınır.

create table if not exists public.shopping_favorites (
  household_id uuid not null references public.households(id) on delete cascade,
  catalog_key text not null,
  uses int not null default 0,
  last_used_at timestamptz not null default now(),
  primary key (household_id, catalog_key)
);

alter table public.shopping_favorites enable row level security;
drop policy if exists shfav_all on public.shopping_favorites;
create policy shfav_all on public.shopping_favorites for all
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

-- Katalogdan eklenen ürün sayacı artırır. p_catalog_key boşsa (elle yazılan
-- kalem) sayaç işlemez — kataloğu olmayan bir şeyi favorilerde gösteremeyiz.
create or replace function public.shopping_add_item(
  p_name text, p_list_id uuid default null, p_qty text default null,
  p_catalog_key text default null)
returns public.shopping_items language plpgsql security definer set search_path = public as $$
declare v_hid uuid; v_list uuid; out_row public.shopping_items;
begin
  if p_list_id is not null then
    select household_id into v_hid from public.shopping_lists where id = p_list_id;
    v_list := p_list_id;
  else
    select hm.household_id into v_hid
      from public.household_members hm
      left join public.profiles pr on pr.user_id = hm.user_id
     where hm.user_id = auth.uid() and hm.is_active
     order by (hm.household_id = pr.default_household_id) desc, hm.created_at
     limit 1;
    if v_hid is null then raise exception 'hane bulunamadı'; end if;
    v_list := public.shopping_default_list(v_hid);
  end if;

  if not public.is_household_member(v_hid) then raise exception 'yetki yok'; end if;

  insert into public.shopping_items (household_id, list_id, name, qty, added_by_member_id)
  values (v_hid, v_list, p_name, p_qty, public.my_member_id(v_hid))
  returning * into out_row;

  if p_catalog_key is not null and p_catalog_key <> '' then
    insert into public.shopping_favorites (household_id, catalog_key, uses, last_used_at)
    values (v_hid, p_catalog_key, 1, now())
    on conflict (household_id, catalog_key)
      do update set uses = public.shopping_favorites.uses + 1, last_used_at = now();
  end if;

  return out_row;
end $$;

-- En çok eklenenler. Eşitlikte son kullanılan önce: mevsim değişince liste
-- kendiliğinden tazelenir.
create or replace function public.shopping_favorites_top(p_limit int default 12)
returns table (catalog_key text, uses int)
language sql stable security definer set search_path = public as $$
  select f.catalog_key, f.uses
    from public.shopping_favorites f
    join public.household_members hm
      on hm.household_id = f.household_id and hm.user_id = auth.uid() and hm.is_active
   order by f.uses desc, f.last_used_at desc
   limit greatest(1, least(coalesce(p_limit, 12), 40));
$$;

revoke all on function public.shopping_add_item(text, uuid, text, text) from public;
revoke all on function public.shopping_favorites_top(int) from public;
grant execute on function public.shopping_add_item(text, uuid, text, text) to authenticated;
grant execute on function public.shopping_favorites_top(int) to authenticated;

-- 0016'daki üç parametreli sürüm artık çağrılmıyor; imza çakışmasın.
drop function if exists public.shopping_add_item(text, uuid, text);
