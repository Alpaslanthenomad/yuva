-- 0015 — Misafir rolü kaldırıldı
--
-- Gerekçe: uygulama yalnızca hanenin kendi üyeleri için. Bakıcı gibi dışarıdan
-- biri senaryosu yok. Üç rollü bir erişim modeli (yetişkin/çocuk/misafir)
-- hem gereksiz hem de sızıntı yüzeyi büyütüyordu — dış incelemede misafirin
-- ajanda üzerinden ödeme tutarlarını görebildiği tespit edilmişti.
--
-- Kaldırınca erişim modeli kendiliğinden sadeleşiyor: çocuk profillerinin
-- hesabı yok (CLAUDE.md kuralı), dolayısıyla GİRİŞ YAPABİLEN her üye
-- yetişkindir. "Misafir para göremez" şartı artık yapısal olarak sağlanıyor,
-- kontrol edilecek bir durum kalmıyor.
--
-- can_see_money yine de rol bakmaya devam ediyor: ileride 'teen' gibi bir rol
-- eklenirse kural tek yerde duruyor.
--
-- Postgres enum'dan değer düşürmeyi desteklemiyor; tip yeniden kuruluyor.

-- Fonksiyon imzası member_role içerdiği için tip değişmeden önce düşürülmeli.
drop function if exists public.rotate_join_code(uuid, member_role, int, int);

-- Varsa misafirleri yetişkine çevir (bu hanede yok, savunma amaçlı).
update public.household_members set role = 'adult' where role = 'guest';
update public.households set join_code_role = 'adult' where join_code_role = 'guest';

alter type member_role rename to member_role_old;
create type member_role as enum ('adult', 'child');

alter table public.household_members alter column role drop default;
alter table public.household_members
  alter column role type member_role using role::text::member_role;
alter table public.household_members alter column role set default 'adult';

alter table public.households alter column join_code_role drop default;
alter table public.households
  alter column join_code_role type member_role using join_code_role::text::member_role;
alter table public.households alter column join_code_role set default 'adult';

drop type member_role_old;

-- Yeni tiple geri kur.
create or replace function public.rotate_join_code(
  hid uuid, p_role member_role default 'adult',
  p_hours int default 168, p_uses int default 1)
returns text language plpgsql security definer set search_path = public as $$
declare v_code text;
begin
  if not public.is_household_adult(hid) then raise exception 'yetki yok'; end if;
  if p_uses < 1 or p_uses > 10 then raise exception 'kullanım hakkı 1-10 arası olmalı'; end if;
  if p_hours < 1 or p_hours > 720 then raise exception 'süre 1-720 saat arası olmalı'; end if;

  v_code := upper(substr(encode(gen_random_bytes(6),'hex'),1,8));
  update public.households
     set join_code = v_code,
         join_code_role = p_role,
         join_code_uses_left = p_uses,
         join_code_expires_at = now() + make_interval(hours => p_hours),
         updated_at = now()
   where id = hid;
  return v_code;
end $$;

revoke all on function public.rotate_join_code(uuid, member_role, int, int) from public;
grant execute on function public.rotate_join_code(uuid, member_role, int, int) to authenticated;
