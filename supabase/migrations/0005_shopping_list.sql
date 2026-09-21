-- 0005_shopping_list.sql — yeni hane varsayılan alışveriş listesiyle açılsın.
--
-- Hata: create_household kategorileri ve bir hesabı tohumluyordu ama alışveriş
-- listesi açmıyordu. shopping_lists boş kalınca Aile › Alışveriş sekmesi
-- bomboş görünüyordu; kullanıcı kalem ekleyemiyordu çünkü ekleyecek liste yoktu.

create or replace function public.create_household(
  p_name text,
  p_base_currency char(3) default 'CLP',
  p_timezone text default 'America/Santiago',
  p_display_name text default null,
  p_locale text default 'tr')
returns uuid language plpgsql security definer set search_path = public as $$
declare hid uuid; nm text; loc text := case when left(coalesce(p_locale,'tr'),2) = 'es' then 'es' else 'tr' end;
begin
  if auth.uid() is null then raise exception 'giriş gerekli / se requiere iniciar sesión'; end if;

  insert into public.households (name, base_currency, timezone, locale, created_by)
    values (p_name, p_base_currency, p_timezone, loc, auth.uid()) returning id into hid;

  select coalesce(p_display_name, full_name, case when loc='es' then 'Yo' else 'Ben' end)
    into nm from public.profiles where user_id = auth.uid();

  insert into public.household_members (household_id, user_id, display_name, role, locale)
    values (hid, auth.uid(), coalesce(nm, 'Ben'), 'adult', loc);

  update public.profiles set default_household_id = hid where user_id = auth.uid();

  insert into public.accounts (household_id, name, type, currency, icon)
    values (hid, case when loc='es' then 'Efectivo' else 'Nakit' end, 'cash', p_base_currency, '💵');

  -- YENİ: varsayılan alışveriş listesi
  insert into public.shopping_lists (household_id, name, icon)
    values (hid, case when loc='es' then 'Supermercado' else 'Market' end, '🛒');

  perform public.seed_default_categories(hid, loc);
  return hid;
end $$;

-- Mevcut haneler için tek seferlik telafi: listesi olmayana bir tane aç.
insert into public.shopping_lists (household_id, name, icon)
select h.id, case when h.locale = 'es' then 'Supermercado' else 'Market' end, '🛒'
from public.households h
where not exists (
  select 1 from public.shopping_lists s where s.household_id = h.id
);
