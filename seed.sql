-- YUVA seed — kurlar (örnek; gerçek kurları hane yetişkini günceller veya Faz 3 API çeker)
-- 1 base = rate quote
insert into public.fx_rates (rate_date, base, quote, rate, source) values
  ('2026-09-01','USD','CLP', 940.00000000, 'seed'),
  ('2026-09-01','USD','TRY',  44.50000000, 'seed'),
  ('2026-09-01','USD','EUR',   0.91000000, 'seed'),
  ('2026-09-01','EUR','CLP',1032.00000000, 'seed'),
  ('2026-09-01','EUR','TRY',  48.90000000, 'seed')
on conflict do nothing;

-- Kategoriler hane kurulurken `seed_default_categories(hid)` ile üretilir.
-- pg_cron kurulumu (Supabase Dashboard → Database → Extensions → pg_cron aç):
-- select cron.schedule('yuva_post_due_recurring', '15 6 * * *', $$select public.post_due_recurring()$$);
