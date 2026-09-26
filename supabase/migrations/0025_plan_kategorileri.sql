-- 0025 — Plan kategorileri, harcamasız planlar, saat
--
-- İSTEK: "planlar sayfası çok boş; arkadaşlar evine davet etti, bunu
-- planlayamıyorum. Bütün planlar harcama gerektirsin ama gerektirmesin,
-- planlama sayfasında hazırlansın."
--
-- plan_kind (trip/gathering/project/goal) DAVRANIŞI belirliyor — hedefte
-- ilerleme katkıdan gelir, seyahat takvimde bant olur. Kullanıcının gördüğü
-- tür ise daha ince: "misafirliğe gidiyoruz", "evde misafir ağırlıyoruz",
-- "günübirlik gezi"... Bunlar için ayrı bir `category` alanı. İkisini tek
-- alanda birleştirmek, her yeni ikonlu kategori için enum ve davranış kodunu
-- değiştirmek demekti.
--
-- has_money: planın parası var mı. Misafirliğe gitmenin bütçesi yok; olsa
-- olsa bir hediye. Kapalıyken ekranda bütçe, gerçekleşen, harcama sekmesi
-- hiç görünmüyor. Var olan planlar için açık kalıyor (önceki davranış).
--
-- start_time: "cumartesi 19:00'da Ayşe'lerde". Tarih vardı, saat yoktu;
-- saatsiz bir davet hatırlatması "bugün bir şey var" demekten öteye geçemez.

alter table public.plans add column if not exists category   text;
alter table public.plans add column if not exists has_money  boolean not null default true;
alter table public.plans add column if not exists start_time time;

update public.plans
   set category = case kind when 'trip' then 'trip' when 'gathering' then 'host'
                            when 'project' then 'home' when 'goal' then 'goal' end
 where category is null;

-- Bildirim tercihi olay ve blok düzeyinde (0026 kullanıyor). Varsayılan açık:
-- kullanıcının isteği hatırlatmanın "aktive edilmesi".
alter table public.calendar_events add column if not exists notify boolean not null default true;
alter table public.day_blocks      add column if not exists notify boolean not null default true;
