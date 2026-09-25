-- 0023 — Aile albümü ve günün karesi
--
-- İSTEK: "bir albüm ya da 5-10 fotoğraf... bunu günlük olarak değiştir,
-- home sayfasında görünsün."
--
-- ALBÜM HANEYE AİT, KİŞİYE DEĞİL. Günün karesi iki eşte de aynı olsun diye
-- seçim veritabanında, tarihe bağlı ve rastgele DEĞİL: aynı gün herkes aynı
-- fotoğrafı görür, ertesi gün sıradaki gelir, hepsi dönmeden tekrar yok.
--
-- DOSYALAR ÖZEL. Aile fotoğrafı (çocuklar dahil olabilir) herkese açık bir
-- adreste durmamalı. Bucket 'public' değil; ekran kısa ömürlü imzalı adresle
-- gösteriyor. Yol düzeni "<hane_id>/<dosya>" ve erişim kuralı o ilk klasöre
-- bakıyor: başka hanenin klasörü görünmez, yazılamaz.
--
-- BOYUT: dosyalar yüklenmeden önce telefonda küçültülüyor (en uzun kenar
-- 1600 px, JPEG). Bu hem kotayı korur hem de konum bilgisini (EXIF/GPS)
-- siler — yeniden kodlanan görüntüde meta veri taşınmaz. Sunucu tarafında
-- 3 MB tavan bu kuralın emniyeti.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('album', 'album', false, 3145728, array['image/jpeg', 'image/webp', 'image/png'])
on conflict (id) do update
  set public = false, file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Nesne adının ilk klasörünü güvenle hane kimliğine çevirir. Biçim tutmazsa
-- null döner; null üye kontrolünden geçemez, yani istek reddedilir.
create or replace function public.album_hid(p_name text)
returns uuid language sql immutable set search_path = public as $$
  select case when split_part(p_name, '/', 1) ~ '^[0-9a-fA-F-]{36}$'
              then split_part(p_name, '/', 1)::uuid end;
$$;

drop policy if exists album_oku  on storage.objects;
drop policy if exists album_yaz  on storage.objects;
drop policy if exists album_sil  on storage.objects;
create policy album_oku on storage.objects for select to authenticated
  using (bucket_id = 'album' and public.is_household_member(public.album_hid(name)));
create policy album_yaz on storage.objects for insert to authenticated
  with check (bucket_id = 'album' and public.is_household_member(public.album_hid(name)));
create policy album_sil on storage.objects for delete to authenticated
  using (bucket_id = 'album' and public.is_household_member(public.album_hid(name)));

create table if not exists public.album_photos (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references public.households(id) on delete cascade,
  path          text not null unique,
  width         int,
  height        int,
  added_by      uuid references public.household_members(id) on delete set null,
  created_at    timestamptz not null default now(),
  -- Yol bu hanenin klasöründe olmalı; başka hanenin dosyasını kendi
  -- albümüne bağlamak mümkün olmasın.
  check (public.album_hid(path) = household_id)
);
create index if not exists album_photos_hane on public.album_photos (household_id, created_at);

alter table public.album_photos enable row level security;
drop policy if exists album_photos_hane on public.album_photos;
create policy album_photos_hane on public.album_photos for all
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

-- Günün karesi. Sıra eklenme sırası; gün numarası fotoğraf sayısına bölünüp
-- kalan alınıyor. Böylece:
--   * aynı gün herkes aynı kareyi görür (rastgele değil),
--   * 7 fotoğraf varsa her biri haftada bir kez gelir,
--   * yeni fotoğraf eklenince döngü kendiliğinden genişler.
create or replace function public.photo_of_day(hid uuid, p_date date default current_date)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare adet int; sira int; res jsonb;
begin
  if not public.is_household_member(hid) then raise exception 'yetki yok'; end if;
  select count(*) into adet from public.album_photos where household_id = hid;
  if adet = 0 then return jsonb_build_object('count', 0); end if;
  sira := ((p_date - date '2024-01-01') % adet + adet) % adet;
  select jsonb_build_object('id', id, 'path', path, 'width', width, 'height', height, 'count', adet)
    into res
    from public.album_photos
   where household_id = hid
   order by created_at, id
  offset sira limit 1;
  return res;
end $$;

revoke all on function public.photo_of_day(uuid, date) from public, anon;
grant execute on function public.photo_of_day(uuid, date) to authenticated;
