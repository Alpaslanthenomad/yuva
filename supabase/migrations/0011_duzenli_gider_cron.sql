-- 0011 — Düzenli giderlerin otomatik işlenmesi (pg_cron)
--
-- İki sorun vardı:
--  1. `post_due_recurring()` yazılmıştı ama hiçbir şey çağırmıyordu; vadesi
--     geçen düzenli gider ne işlenmiyor ne bildirim üretiyordu.
--  2. Fonksiyon her çalışmada vadeyi YALNIZCA bir dönem ilerletiyordu. Uygulama
--     üç ay kullanılmazsa üç aylık kira için tek işlem yazılıyor ve kayıt hâlâ
--     geçmişte kalıyordu. Günlük cron'la günde bir dönem kapanırdı — üç aylık
--     gecikme üç ayda kapanır. Artık yakalanana kadar döngüde ilerliyor.
--
-- Otomatik işlenen giderde her geçmiş dönem için ayrı işlem yazılır (her biri
-- gerçekten ödendi). Otomatik işlenmeyende tek bildirim üretilir — üç aylık
-- gecikme için üç bildirim atmak gürültü olurdu.

-- Vade ilerletme tek yerde: 0001'de üç ayrı yere kopyalanmıştı.
create or replace function public.recurring_next(p_rrule text, p_from date)
returns date language sql immutable set search_path = public as $$
  select case
    when p_rrule ilike '%FREQ=WEEKLY%' then p_from + interval '1 week'
    when p_rrule ilike '%FREQ=YEARLY%' then p_from + interval '1 year'
    when p_rrule ilike '%FREQ=DAILY%'  then p_from + interval '1 day'
    else p_from + interval '1 month' end;
$$;

create or replace function public.post_due_recurring()
returns int language plpgsql security definer set search_path = public as $$
declare r record; n int := 0; nxt date; cur date; guard int;
begin
  for r in select * from public.recurring_rules
            where is_active and next_due_on <= current_date loop

    cur := r.next_due_on;
    guard := 0;

    if r.auto_post and r.account_id is not null then
      -- Geçmiş her dönem için işlem yaz.
      while cur <= current_date and guard < 240 loop
        guard := guard + 1;
        insert into public.transactions (household_id, kind, account_id, amount, currency,
                                         occurred_on, category_id, merchant, recurring_id, note)
        values (r.household_id, r.kind, r.account_id, r.amount, r.currency,
                cur, r.category_id, r.name, r.id, 'otomatik');
        n := n + 1;
        cur := public.recurring_next(r.rrule, cur);
      end loop;
    else
      -- Tek bildirim, sonra vadeyi bugünün ötesine taşı.
      insert into public.notifications (household_id, title, body, kind, entity_type, entity_id)
      values (r.household_id, r.name || ' vadesi geldi',
              r.amount::text || ' ' || r.currency, 'bill_due', 'recurring_rules', r.id);
      while cur <= current_date and guard < 240 loop
        guard := guard + 1;
        cur := public.recurring_next(r.rrule, cur);
      end loop;
    end if;

    nxt := cur;
    update public.recurring_rules set next_due_on = nxt, updated_at = now() where id = r.id;
  end loop;
  return n;
end $$;

revoke all on function public.recurring_next(text, date) from public;
revoke all on function public.post_due_recurring() from public;

-- ---------------------------------------------------------------------------
-- Günlük çalıştırma
-- ---------------------------------------------------------------------------
-- cron UTC'de çalışır. Santiago UTC-3 → 12:00 UTC ≈ sabah 09:00.
create extension if not exists pg_cron;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'yuva-post-due-recurring') then
    perform cron.unschedule('yuva-post-due-recurring');
  end if;
  perform cron.schedule('yuva-post-due-recurring', '0 12 * * *',
                        'select public.post_due_recurring();');
end $$;
