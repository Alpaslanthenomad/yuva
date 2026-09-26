-- 0031 — Harcamaya fiş fotoğrafı
--
-- İSTEK: "fiş foto" — harcamaya fişin fotoğrafını eklemek.
--
-- DEPO: özel 'fisler' klasörü (albümle aynı düzen): "<hane_id>/<işlem_id>-<rastgele>.jpg".
-- Fotoğraf telefonda küçültülüp yeniden kodlanıyor (konum bilgisi silinir).
-- transactions.receipt_path sütunu zaten vardı (0001), boş duruyordu.
--
-- GİZLİLİK (0029 ile tutarlı): eşin KİŞİSEL harcamasının fişi de gizli.
-- Okuma kuralı "bu yolu taşıyan ve bana görünen bir işlem var mı" diye
-- bakıyor; işlem tablosunun kuralı zaten eşin kişiseli satırını gizliyor.
-- Silme: görünen işlemin fişi ya da henüz hiçbir işleme bağlanmamış
-- (yükleme yarıda kalmış) dosya. Başkasının kişisel fişi ikisine de girmez.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('fisler', 'fisler', false, 3145728, array['image/jpeg', 'image/webp', 'image/png'])
on conflict (id) do update
  set public = false, file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Bu fişi görebilir miyim? (Tanımlayıcı haklarla; kişisel kuralı elle uygular.)
create or replace function public.fis_gorunur(p_name text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.transactions t
                  where t.receipt_path = p_name
                    and public.can_see_money(t.household_id)
                    and not public.baskasinin_kisiseli(t.household_id, t.for_member_id));
$$;
-- Hiçbir işleme bağlı değil mi? (Yarım kalan yüklemeyi temizlemek için.)
create or replace function public.fis_sahipsiz(p_name text)
returns boolean language sql stable security definer set search_path = public as $$
  select not exists (select 1 from public.transactions t where t.receipt_path = p_name);
$$;
revoke all on function public.fis_gorunur(text)  from public, anon;
revoke all on function public.fis_sahipsiz(text) from public, anon;
grant execute on function public.fis_gorunur(text)  to authenticated;
grant execute on function public.fis_sahipsiz(text) to authenticated;

drop policy if exists fis_oku on storage.objects;
drop policy if exists fis_yaz on storage.objects;
drop policy if exists fis_sil on storage.objects;
create policy fis_oku on storage.objects for select to authenticated
  using (bucket_id = 'fisler' and public.can_see_money(public.album_hid(name)) and public.fis_gorunur(name));
create policy fis_yaz on storage.objects for insert to authenticated
  with check (bucket_id = 'fisler' and public.can_see_money(public.album_hid(name)));
create policy fis_sil on storage.objects for delete to authenticated
  using (bucket_id = 'fisler' and public.can_see_money(public.album_hid(name))
         and (public.fis_gorunur(name) or public.fis_sahipsiz(name)));

-- İşlemdeki fiş yolu kendi hanesinin klasöründe olmalı.
alter table public.transactions drop constraint if exists transactions_receipt_hane;
alter table public.transactions add constraint transactions_receipt_hane
  check (receipt_path is null or public.album_hid(receipt_path) = household_id);
