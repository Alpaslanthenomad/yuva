-- 0004_bootstrap.sql — açılış hızı.
--
-- Sorun: uygulama açılırken tarayıcı sırayla 10 ayrı istek atıyordu
--   getUser → profiles → households → household_members → accounts
--   → categories → fx_rates → upcoming_agenda → month_summary → budget_status
-- Her biri Santiago'dan São Paulo'ya gidip geliyor; toplam ~8 saniye boş ekran.
-- Çözüm: hepsini iki çağrıya indiren iki okuma fonksiyonu. Yetki hâlâ hane
-- üyeliğine bağlı: her iki fonksiyon da çağıranın üyeliğini kendisi doğrular.

-- 1) Açılış paketi: hane + üyeler + ben + hesaplar + kategoriler + kurlar.
create or replace function public.app_bootstrap()
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_uid uuid := auth.uid();
  v_hid uuid;
  v_household jsonb;
  v_empty jsonb := jsonb_build_object('household', null, 'members', '[]'::jsonb, 'me', null);
begin
  if v_uid is null then
    return v_empty;
  end if;

  -- Varsayılan hane; yoksa üyesi olduğu ilk hane.
  select p.default_household_id into v_hid from public.profiles p where p.user_id = v_uid;
  if v_hid is null then
    select hm.household_id into v_hid
    from public.household_members hm
    where hm.user_id = v_uid and hm.is_active
    order by hm.created_at
    limit 1;
  end if;

  if v_hid is null then
    return v_empty;
  end if;

  -- Güvenlik: çağıran gerçekten bu hanenin etkin üyesi mi?
  if not exists (
    select 1 from public.household_members hm
    where hm.household_id = v_hid and hm.user_id = v_uid and hm.is_active
  ) then
    return v_empty;
  end if;

  select to_jsonb(h) into v_household from public.households h where h.id = v_hid;

  return jsonb_build_object(
    'household', v_household,
    'members', coalesce((
      select jsonb_agg(to_jsonb(m) order by m.created_at)
      from public.household_members m
      where m.household_id = v_hid and m.is_active), '[]'::jsonb),
    'me', (
      select to_jsonb(m) from public.household_members m
      where m.household_id = v_hid and m.user_id = v_uid and m.is_active
      limit 1),
    'accounts', coalesce((
      select jsonb_agg(to_jsonb(a) order by a.sort_order)
      from public.accounts a
      where a.household_id = v_hid and not a.is_archived), '[]'::jsonb),
    'categories', coalesce((
      select jsonb_agg(to_jsonb(c) order by c.sort_order)
      from public.categories c
      where c.household_id = v_hid), '[]'::jsonb),
    'rates', coalesce((
      select jsonb_agg(to_jsonb(r))
      from (
        select distinct on (f.base, f.quote) f.base, f.quote, f.rate
        from public.fx_rates f
        order by f.base, f.quote, f.rate_date desc
      ) r), '[]'::jsonb)
  );
end;
$$;

-- 2) Bugün ekranı: ajanda + ay özeti + bütçe + alışveriş + bildirimler.
create or replace function public.today_snapshot(
  hid uuid,
  p_from date default current_date,
  p_days int default 7,
  p_period char(7) default to_char(current_date, 'YYYY-MM')
)
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  if not public.is_household_member(hid) then
    raise exception 'yetkisiz';
  end if;

  return jsonb_build_object(
    'agenda', public.upcoming_agenda(hid, p_from, p_days),
    'month', to_jsonb(public.month_summary(hid, p_period)),
    'budget', coalesce((
      select jsonb_agg(to_jsonb(b)) from public.budget_status(hid, p_period) b), '[]'::jsonb),
    'shopping', coalesce((
      select jsonb_agg(to_jsonb(s) order by s.created_at)
      from public.shopping_items s
      where s.household_id = hid), '[]'::jsonb),
    'notifications', coalesce((
      select jsonb_agg(to_jsonb(n) order by n.fire_at desc)
      from public.notifications n
      where n.household_id = hid and n.read_at is null), '[]'::jsonb)
  );
end;
$$;

-- Yetkiler: 0003'teki sertleştirme kuralı — varsayılan EXECUTE kapalı,
-- yalnızca giriş yapmış kullanıcıya açılır.
revoke all on function public.app_bootstrap() from public;
revoke all on function public.today_snapshot(uuid, date, int, char) from public;
grant execute on function public.app_bootstrap() to authenticated;
grant execute on function public.today_snapshot(uuid, date, int, char) to authenticated;
