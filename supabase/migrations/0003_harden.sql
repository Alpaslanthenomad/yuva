-- ============================================================================
-- YUVA — 0003_harden.sql
-- Supabase security advisor bulgularının kapatılması.
--
-- Sorun: Supabase, public şemasındaki TÜM fonksiyonlara anon + authenticated
-- rolleri için varsayılan EXECUTE yetkisi verir ve hepsini /rest/v1/rpc/<ad>
-- adresinden çağrılabilir yapar. SECURITY DEFINER fonksiyonlar sahibin
-- yetkisiyle çalıştığı için bu, RLS'i tamamen atlayan bir kapı bırakır.
--
-- En ciddisi: post_due_recurring() — giriş yapmamış biri bu ucu çağırıp
-- BÜTÜN hanelerin düzenli ödemelerini işleyebilir, sahte işlem yaratabilirdi.
--
-- Kural: varsayılan olarak her şeyi kapat, sonra yalnızca gerekeni aç.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. set_updated_at: search_path sabitlensin (advisor: function_search_path_mutable)
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin new.updated_at := now(); return new; end $$;

-- ---------------------------------------------------------------------------
-- 2. Trigger fonksiyonları: hiçbir istemci rolü çağıramasın.
--    Trigger'lar EXECUTE yetkisini ateşleme anında kontrol etmez (yalnızca
--    trigger oluşturulurken bakılır), bu yüzden revoke güvenlidir.
-- ---------------------------------------------------------------------------
revoke all on function public.set_updated_at()             from public, anon, authenticated;
revoke all on function public.handle_new_user()            from public, anon, authenticated;
revoke all on function public.log_activity()               from public, anon, authenticated;
revoke all on function public.sync_member_birthday()       from public, anon, authenticated;
revoke all on function public.transactions_compute_base()  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. Yalnızca sunucu tarafı: pg_cron / service_role çağırır, istemci asla.
-- ---------------------------------------------------------------------------
revoke all on function public.post_due_recurring()                from public, anon, authenticated;
revoke all on function public.seed_default_categories(uuid, text) from public, anon, authenticated;
-- seed_default_categories'i create_household içeriden çağırır; o fonksiyon
-- SECURITY DEFINER olduğu için sahibin yetkisiyle çalışır ve erişebilir.

-- ---------------------------------------------------------------------------
-- 4. RLS yardımcıları: `authenticated` MUTLAKA çağırabilmeli.
--    Bu fonksiyonlar RLS politikalarının içinden, sorguyu yapan rolün
--    yetkisiyle çalıştırılır. authenticated'tan EXECUTE alınırsa her politika
--    çöker ve uygulama tamamen erişimsiz kalır. Yalnızca anon kapatılır.
-- ---------------------------------------------------------------------------
revoke all on function public.is_household_member(uuid) from public, anon;
revoke all on function public.is_household_adult(uuid)  from public, anon;
revoke all on function public.my_member_id(uuid)        from public, anon;
grant execute on function public.is_household_member(uuid) to authenticated;
grant execute on function public.is_household_adult(uuid)  to authenticated;
grant execute on function public.my_member_id(uuid)        to authenticated;

-- ---------------------------------------------------------------------------
-- 5. Uygulama API'si: giriş yapmış kullanıcıya açık, anon'a kapalı.
--    (Fonksiyonların kendi içinde de is_household_member kontrolü var;
--     bu katman ikinci savunma hattı.)
-- ---------------------------------------------------------------------------
revoke all on function public.month_summary(uuid, char)        from public, anon;
revoke all on function public.budget_status(uuid, char)        from public, anon;
revoke all on function public.upcoming_agenda(uuid, date, int) from public, anon;
revoke all on function public.create_household(text, char, text, text, text) from public, anon;
revoke all on function public.join_household(text, text)       from public, anon;
grant execute on function public.month_summary(uuid, char)        to authenticated;
grant execute on function public.budget_status(uuid, char)        to authenticated;
grant execute on function public.upcoming_agenda(uuid, date, int) to authenticated;
grant execute on function public.create_household(text, char, text, text, text) to authenticated;
grant execute on function public.join_household(text, text)       to authenticated;

-- fx_lookup SECURITY DEFINER değil (çağıranın yetkisiyle çalışır, fx_rates'te
-- RLS var), yine de anon'a kapatılır.
revoke all on function public.fx_lookup(char, char, date) from public, anon;
grant execute on function public.fx_lookup(char, char, date) to authenticated;

-- ---------------------------------------------------------------------------
-- 6. Bundan sonra eklenecek fonksiyonlar da varsayılan olarak anon'a kapalı olsun.
-- ---------------------------------------------------------------------------
alter default privileges in schema public revoke execute on functions from anon;

-- ============================================================================
-- Doğrulama: Supabase Studio → Advisors → Security.
--
-- Bu migration sonrası advisor'da 8 uyarı KALIR ve bu beklenen durumdur:
-- budget_status, month_summary, upcoming_agenda, create_household,
-- join_household, is_household_member, is_household_adult, my_member_id
-- — hepsi "authenticated rolü bu SECURITY DEFINER fonksiyonu çağırabiliyor"
-- diyor. Zaten çağırabilmesi gerekiyor: uygulamanın API'si bunlar.
-- Güvenliği sağlayan şey, her birinin İÇİNDE hane üyeliği kontrolü olması
-- (is_household_member(hid) → yetki yok hatası ya da boş sonuç).
-- Üyelik yardımcıları ise yalnızca ÇAĞIRANIN kendi üyeliğini söyler,
-- başkası hakkında bilgi sızdırmaz; RLS politikaları bunlara muhtaçtır.
--
-- Yeni bir RPC eklerken §5 kalıbını izle: önce revoke, sonra grant.
-- ============================================================================
