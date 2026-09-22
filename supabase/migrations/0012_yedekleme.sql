-- 0012 — Tam yedek (dışa aktarma)
-- Mevcut CSV yalnızca para işlemlerini kapsıyordu; takvim, planlar, görevler,
-- belgeler ve alışveriş hiçbir yere çıkmıyordu. Supabase projesi silinse veya
-- hesaba erişim kaybolsa geri dönüşü olmayan tek şey buydu.
--
-- Tek RPC tüm haneyi jsonb olarak döndürür; ön yüz dosya olarak indirir.
-- Yetki: yedek finansal veriyi de içerdiği için yalnızca yetişkin (0007).
--
-- Kapsam dışı bilerek: notifications ve activity_log (geçici/gürültü),
-- fx_rates (haneye ait değil, ortak tablo).
--
-- `format` alanı ileride geri yükleyici yazılırken sürüm ayrımı için.

create or replace function public.export_household(hid uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare res jsonb;
begin
  if not public.can_see_money(hid) then raise exception 'yetki yok'; end if;

  select jsonb_build_object(
    'format', 'yuva-backup-1',
    'exported_at', now(),
    'household', (select to_jsonb(h) from public.households h where h.id = hid),
    'members', (select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at), '[]'::jsonb)
                  from public.household_members x where x.household_id = hid),
    'accounts', (select coalesce(jsonb_agg(to_jsonb(x) order by x.sort_order), '[]'::jsonb)
                  from public.accounts x where x.household_id = hid),
    'categories', (select coalesce(jsonb_agg(to_jsonb(x) order by x.sort_order), '[]'::jsonb)
                  from public.categories x where x.household_id = hid),
    'recurring_rules', (select coalesce(jsonb_agg(to_jsonb(x) order by x.next_due_on), '[]'::jsonb)
                  from public.recurring_rules x where x.household_id = hid),
    'plans', (select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at), '[]'::jsonb)
                  from public.plans x where x.household_id = hid),
    'plan_items', (select coalesce(jsonb_agg(to_jsonb(x) order by x.sort_order), '[]'::jsonb)
                  from public.plan_items x where x.household_id = hid),
    'calendar_events', (select coalesce(jsonb_agg(to_jsonb(x) order by x.starts_at), '[]'::jsonb)
                  from public.calendar_events x where x.household_id = hid),
    'event_attendees', (select coalesce(jsonb_agg(to_jsonb(a)), '[]'::jsonb)
                  from public.event_attendees a
                  join public.calendar_events e on e.id = a.event_id
                 where e.household_id = hid),
    'transactions', (select coalesce(jsonb_agg(to_jsonb(x) order by x.occurred_on), '[]'::jsonb)
                  from public.transactions x where x.household_id = hid),
    'budgets', (select coalesce(jsonb_agg(to_jsonb(x) order by x.period), '[]'::jsonb)
                  from public.budgets x where x.household_id = hid),
    'goal_contributions', (select coalesce(jsonb_agg(to_jsonb(x) order by x.on_date), '[]'::jsonb)
                  from public.goal_contributions x where x.household_id = hid),
    'occasions', (select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb)
                  from public.occasions x where x.household_id = hid),
    'documents', (select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb)
                  from public.documents x where x.household_id = hid),
    'contacts', (select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb)
                  from public.contacts x where x.household_id = hid),
    'tasks', (select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at), '[]'::jsonb)
                  from public.tasks x where x.household_id = hid),
    'task_completions', (select coalesce(jsonb_agg(to_jsonb(x) order by x.done_on), '[]'::jsonb)
                  from public.task_completions x where x.household_id = hid),
    'shopping_lists', (select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb)
                  from public.shopping_lists x where x.household_id = hid),
    'shopping_items', (select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at), '[]'::jsonb)
                  from public.shopping_items x where x.household_id = hid)
  ) into res;

  return res;
end $$;

revoke all on function public.export_household(uuid) from public;
grant execute on function public.export_household(uuid) to authenticated;
