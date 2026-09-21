-- ============================================================================
-- YUVA — 0002_i18n.sql
-- İki dillilik (TR / ES): hane ve üye dili, dile göre varsayılan kategoriler.
-- 0001 uygulandıktan SONRA çalıştırılır. Idempotent.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Dil kolonları
-- ---------------------------------------------------------------------------
-- households.locale artık iki harfli kod ('tr' | 'es'); eski 'tr-TR' değerleri kırpılır.
update public.households set locale = left(locale, 2) where length(locale) > 2;

alter table public.households alter column locale set default 'tr';
alter table public.households drop constraint if exists households_locale_chk;
alter table public.households add constraint households_locale_chk check (locale in ('tr', 'es'));

-- Üye bazlı dil: kişi kendi dilini seçer, cihazdan bağımsız taşınır (Faz 1'de okunur).
alter table public.household_members add column if not exists locale text;
alter table public.household_members drop constraint if exists hm_locale_chk;
alter table public.household_members add constraint hm_locale_chk check (locale is null or locale in ('tr', 'es'));

-- ---------------------------------------------------------------------------
-- 2. Dile göre varsayılan kategoriler
--    Eski tek parametreli sürüm düşürülür; yoksa 1 argümanlı çağrı belirsiz kalır.
-- ---------------------------------------------------------------------------
drop function if exists public.seed_default_categories(uuid);

create or replace function public.seed_default_categories(hid uuid, p_locale text default 'tr')
returns void language plpgsql security definer set search_path = public as $$
declare p uuid; es boolean := (left(coalesce(p_locale, 'tr'), 2) = 'es');
begin
  if exists (select 1 from public.categories where household_id = hid) then return; end if;

  -- Ev / Casa
  insert into public.categories (household_id,name,kind,icon,is_fixed,sort_order)
    values (hid, case when es then 'Casa' else 'Ev' end, 'expense','🏠',true,1) returning id into p;
  insert into public.categories (household_id,parent_id,name,kind,icon,is_fixed) values
    (hid,p, case when es then 'Arriendo / Dividendo' else 'Kira / Konut kredisi' end,'expense','🔑',true),
    (hid,p, case when es then 'Gastos comunes'       else 'Aidat'                 end,'expense','🏢',true),
    (hid,p, case when es then 'Electricidad'         else 'Elektrik'              end,'expense','💡',true),
    (hid,p, case when es then 'Agua'                 else 'Su'                    end,'expense','🚿',true),
    (hid,p, case when es then 'Gas'                  else 'Gaz'                   end,'expense','🔥',true),
    (hid,p, case when es then 'Internet y teléfono'  else 'İnternet & Telefon'    end,'expense','📶',true),
    (hid,p, case when es then 'Mantención y arreglos' else 'Bakım & Tamir'        end,'expense','🔧',false);

  -- Market / Supermercado
  insert into public.categories (household_id,name,kind,icon,sort_order)
    values (hid, case when es then 'Supermercado' else 'Market' end,'expense','🛒',2) returning id into p;
  insert into public.categories (household_id,parent_id,name,kind,icon) values
    (hid,p, case when es then 'Alimentos'       else 'Gıda'          end,'expense','🥦'),
    (hid,p, case when es then 'Aseo'            else 'Temizlik'      end,'expense','🧼'),
    (hid,p, case when es then 'Cuidado personal' else 'Kişisel bakım' end,'expense','🧴');

  -- Ulaşım / Transporte
  insert into public.categories (household_id,name,kind,icon,sort_order)
    values (hid, case when es then 'Transporte' else 'Ulaşım' end,'expense','🚗',3) returning id into p;
  insert into public.categories (household_id,parent_id,name,kind,icon) values
    (hid,p, case when es then 'Bencina'              else 'Yakıt'                  end,'expense','⛽'),
    (hid,p, case when es then 'Transporte público'   else 'Toplu taşıma'           end,'expense','🚇'),
    (hid,p, case when es then 'Taxi / Uber'          else 'Taksi / Uber'           end,'expense','🚕'),
    (hid,p, case when es then 'Mantención y seguro'  else 'Araç bakım & sigorta'   end,'expense','🛠️'),
    (hid,p, case when es then 'Estacionamiento y TAG' else 'Otopark & Geçiş'       end,'expense','🅿️');

  -- Çocuklar / Niños
  insert into public.categories (household_id,name,kind,icon,sort_order)
    values (hid, case when es then 'Niños' else 'Çocuklar' end,'expense','🧒',4) returning id into p;
  insert into public.categories (household_id,parent_id,name,kind,icon,is_fixed) values
    (hid,p, case when es then 'Colegio'               else 'Okul'            end,'expense','🎒',true),
    (hid,p, case when es then 'Talleres y actividades' else 'Kurs & Aktivite' end,'expense','🎨',false),
    (hid,p, case when es then 'Ropa'                  else 'Giyim'           end,'expense','👕',false),
    (hid,p, case when es then 'Mesada'                else 'Harçlık'         end,'expense','🪙',false),
    (hid,p, case when es then 'Juguetes'              else 'Oyuncak'         end,'expense','🧸',false);

  -- Sağlık / Salud
  insert into public.categories (household_id,name,kind,icon,sort_order)
    values (hid, case when es then 'Salud' else 'Sağlık' end,'expense','🩺',5) returning id into p;
  insert into public.categories (household_id,parent_id,name,kind,icon,is_fixed) values
    (hid,p, case when es then 'Isapre / Fonasa'  else 'Sağlık sigortası' end,'expense','🛡️',true),
    (hid,p, case when es then 'Médico y dentista' else 'Doktor & Diş'    end,'expense','🦷',false),
    (hid,p, case when es then 'Farmacia'          else 'Eczane'          end,'expense','💊',false);

  -- Yeme-İçme / Comer fuera
  insert into public.categories (household_id,name,kind,icon,sort_order)
    values (hid, case when es then 'Comer fuera' else 'Yeme-İçme' end,'expense','🍽️',6) returning id into p;
  insert into public.categories (household_id,parent_id,name,kind,icon) values
    (hid,p, case when es then 'Restaurante' else 'Restoran' end,'expense','🍝'),
    (hid,p, case when es then 'Café'        else 'Kafe'     end,'expense','☕'),
    (hid,p, case when es then 'Delivery'    else 'Sipariş'  end,'expense','🛵');

  -- Eğlence & Sosyal / Ocio y social
  insert into public.categories (household_id,name,kind,icon,sort_order)
    values (hid, case when es then 'Ocio y social' else 'Eğlence & Sosyal' end,'expense','🎉',7) returning id into p;
  insert into public.categories (household_id,parent_id,name,kind,icon,is_fixed) values
    (hid,p, case when es then 'Suscripciones'    else 'Abonelikler'      end,'expense','📺',true),
    (hid,p, case when es then 'Panoramas y cine' else 'Etkinlik & Sinema' end,'expense','🎬',false),
    (hid,p, case when es then 'Regalos'          else 'Hediye'           end,'expense','🎁',false),
    (hid,p, case when es then 'Celebraciones'    else 'Davet & Misafir'  end,'expense','🥂',false);

  -- Seyahat / Viajes
  insert into public.categories (household_id,name,kind,icon,sort_order)
    values (hid, case when es then 'Viajes' else 'Seyahat' end,'expense','✈️',8) returning id into p;
  insert into public.categories (household_id,parent_id,name,kind,icon) values
    (hid,p, case when es then 'Pasajes'        else 'Uçak & Bilet'        end,'expense','🎫'),
    (hid,p, case when es then 'Alojamiento'    else 'Konaklama'           end,'expense','🏨'),
    (hid,p, case when es then 'Gastos en viaje' else 'Seyahatte harcama'  end,'expense','🧳');

  -- Tek seviyeli giderler
  insert into public.categories (household_id,name,kind,icon,sort_order) values
    (hid, case when es then 'Ropa'              else 'Giyim'           end,'expense','👗',9),
    (hid, case when es then 'Educación y libros' else 'Eğitim & Kitap'  end,'expense','📚',10),
    (hid, case when es then 'Mascotas'          else 'Evcil hayvan'     end,'expense','🐾',11),
    (hid, case when es then 'Impuestos y trámites' else 'Vergi & Resmi' end,'expense','🏛️',12),
    (hid, case when es then 'Otros'             else 'Diğer'            end,'expense','🏷️',99);

  -- Gelirler / Ingresos
  insert into public.categories (household_id,name,kind,icon,sort_order) values
    (hid, case when es then 'Sueldo'              else 'Maaş'                  end,'income','💼',1),
    (hid, case when es then 'Asesorías / Boletas' else 'Danışmanlık / Serbest' end,'income','🧪',2),
    (hid, case when es then 'Arriendo recibido'   else 'Kira geliri'           end,'income','🏘️',3),
    (hid, case when es then 'Dividendos e intereses' else 'Temettü / Faiz'     end,'income','📈',4),
    (hid, case when es then 'Regalos y apoyo'     else 'Hediye / Destek'       end,'income','🎁',5),
    (hid, case when es then 'Otros ingresos'      else 'Diğer gelir'           end,'income','➕',99);
end $$;

-- ---------------------------------------------------------------------------
-- 3. create_household: dil parametresi
--    Eski 4 parametreli sürüm düşürülür (aksi halde çağrı belirsiz olur).
-- ---------------------------------------------------------------------------
drop function if exists public.create_household(text, char, text, text);

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

  perform public.seed_default_categories(hid, loc);
  return hid;
end $$;

-- ---------------------------------------------------------------------------
-- 4. join_household: yeni üye hanenin dilini devralır
-- ---------------------------------------------------------------------------
create or replace function public.join_household(p_code text, p_display_name text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare hid uuid; nm text; loc text;
begin
  if auth.uid() is null then raise exception 'giriş gerekli / se requiere iniciar sesión'; end if;
  select id, locale into hid, loc from public.households where join_code = upper(trim(p_code));
  if hid is null then raise exception 'kod bulunamadı / código no encontrado'; end if;

  select coalesce(p_display_name, full_name, case when loc='es' then 'Integrante' else 'Üye' end)
    into nm from public.profiles where user_id = auth.uid();

  insert into public.household_members (household_id, user_id, display_name, role, locale)
    values (hid, auth.uid(), nm, 'adult', loc)
    on conflict (household_id, user_id) do update set is_active = true;

  update public.profiles set default_household_id = coalesce(default_household_id, hid)
    where user_id = auth.uid();
  return hid;
end $$;

-- ============================================================================
-- Son. Yeni dil eklemek için: lib/i18n/<kod>.js + LOCALES kaydı + buradaki
-- check kısıtları ve seed_default_categories dalları.
-- ============================================================================
