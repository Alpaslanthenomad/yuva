-- 0009 — Cihazlar arası canlı yenileme (Supabase Realtime)
-- Sorun: biri telefondan alışverişe bir şey eklediğinde diğerinin açık ekranı
-- güncellenmiyordu; yenilemek için sayfayı elle tazelemek gerekiyordu.
--
-- İki şey gerekiyor:
--  1. Tablolar `supabase_realtime` yayınında olmalı.
--  2. DELETE olaylarının süzülebilmesi için `replica identity full`. Varsayılan
--     (`default`) yalnızca birincil anahtarı gönderir; o zaman istemcideki
--     `household_id=eq.<id>` süzgeci silme olaylarını hiç yakalamaz ve silinen
--     satır diğer cihazda ekranda kalır. Tek haneli bir uygulamada ek WAL
--     maliyeti önemsiz.
--
-- Not: Realtime, `postgres_changes` aboneliklerinde RLS'i uygular. 0007'den
-- sonra misafir zaten finansal tabloları okuyamadığı için o olaylar da ona
-- gitmez — ayrıca bir şey yapmak gerekmiyor.

do $$
declare t text;
begin
  foreach t in array array[
    'households','household_members','calendar_events','transactions','budgets',
    'recurring_rules','accounts','categories','plans','plan_items',
    'goal_contributions','occasions','documents','contacts','tasks',
    'shopping_lists','shopping_items','notifications'
  ] loop
    execute format('alter table public.%I replica identity full', t);

    if not exists (
      select 1 from pg_publication_tables
       where pubname = 'supabase_realtime'
         and schemaname = 'public'
         and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
