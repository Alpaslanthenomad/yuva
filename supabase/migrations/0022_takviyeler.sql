-- 0022 — Günlük takviyeler (kişisel)
--
-- NEREYE KOYULDU VE NEDEN: hane ortak, takviye değil. Kim ne alıyor kişisel
-- bir şey ve her gün tekrar ediyor; bu yüzden 0021'deki kişisel katmana
-- eklendi, alışveriş listesine değil. Alışveriş listesi "eve ne alacağız"
-- sorusunu yanıtlıyor, burası "bugün aldım mı" sorusunu.
--
-- TIBBİ İÇERİK YOK (CLAUDE.md sınırı): tanı, reçete, ilaç takibi burada
-- tutulmuyor. Tutulan şey bir günlük rutinin işaretlenmesi. 'dose' serbest
-- metin ve kullanıcının kendi yazdığı şey; uygulama doz önermiyor.
--
-- GÜNDE BİRDEN FAZLA: per_day ile sayı tutuluyor. Sabah + akşam alınan bir
-- şeyde tek onay kutusu "yarısını aldım"ı anlatamazdı.

create table if not exists public.supplements (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references public.households(id) on delete cascade,
  member_id     uuid not null references public.household_members(id) on delete cascade,
  catalog_key   text,                      -- katalogdan seçildiyse; serbest yazımda null
  title         text not null,
  icon          text,
  dose          text,                      -- "5 g", "1 kapsül" — serbest metin
  per_day       int  not null default 1 check (per_day between 1 and 6),
  is_active     boolean not null default true,
  sort_order    int not null default 0,
  created_at    timestamptz not null default now()
);

create table if not exists public.supplement_logs (
  supplement_id uuid not null references public.supplements(id) on delete cascade,
  on_date       date not null,
  member_id     uuid not null references public.household_members(id) on delete cascade,
  taken         int  not null default 0 check (taken >= 0),
  primary key (supplement_id, on_date)
);

create index if not exists supplements_uye on public.supplements (member_id) where is_active;
create index if not exists supplement_logs_tarih on public.supplement_logs (supplement_id, on_date);

alter table public.supplements     enable row level security;
alter table public.supplement_logs enable row level security;

-- 0021'deki üye düzeyinde kural. Hanenin diğer üyesi bu satırları göremez.
do $$
declare t text;
begin
  foreach t in array array['supplements','supplement_logs'] loop
    execute format('drop policy if exists %I on public.%I', t || '_kendi', t);
    execute format(
      'create policy %I on public.%I for all '
      'using (member_id in (select id from public.household_members where user_id = auth.uid() and is_active)) '
      'with check (member_id in (select id from public.household_members where user_id = auth.uid() and is_active))',
      t || '_kendi', t);
  end loop;
end $$;

create or replace function public.my_supplements(hid uuid, p_date date default current_date)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare mid uuid; res jsonb;
begin
  mid := public.my_member_id(hid);
  if mid is null then raise exception 'yetki yok'; end if;

  select jsonb_build_object(
    'date', p_date,
    'items', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'id', s.id, 'title', s.title, 'icon', s.icon, 'dose', s.dose,
               'catalog_key', s.catalog_key, 'per_day', s.per_day,
               'taken', coalesce(l.taken, 0),
               'done', coalesce(l.taken, 0) >= s.per_day)
             order by s.sort_order, s.created_at), '[]'::jsonb)
        from public.supplements s
        left join public.supplement_logs l on l.supplement_id = s.id and l.on_date = p_date
       where s.member_id = mid and s.is_active),
    -- Son 7 günün oranı: alınan doz / alınması gereken doz. Takviyesi
    -- olmayan kullanıcıda payda sıfır olur; oran yerine null dönüyor ki
    -- ekranda "%0" diye bir suçlama çıkmasın.
    'adherence7', (
      select case when coalesce(sum(x.hedef), 0) = 0 then null
                  else round(100.0 * sum(x.alinan) / sum(x.hedef)) end
        from (
          select (select coalesce(sum(per_day), 0) from public.supplements
                   where member_id = mid and is_active) as hedef,
                 (select coalesce(sum(l.taken), 0) from public.supplement_logs l
                    join public.supplements s on s.id = l.supplement_id
                   where s.member_id = mid and s.is_active and l.on_date = g::date) as alinan
            from generate_series(p_date - 6, p_date, interval '1 day') g
        ) x)
  ) into res;
  return res;
end $$;

-- p_delta: +1 aldım, -1 geri al. Sonuç 0..per_day arasına kırpılıyor;
-- sıfıra inince satır siliniyor ki "hiç almadım" ile "0 yazdım" aynı şey olsun.
create or replace function public.supplement_take(hid uuid, p_supp uuid, p_delta int default 1,
                                                  p_date date default current_date)
returns int language plpgsql security definer set search_path = public as $$
declare mid uuid; tavan int; yeni int;
begin
  mid := public.my_member_id(hid);
  if mid is null then raise exception 'yetki yok'; end if;
  select per_day into tavan from public.supplements where id = p_supp and member_id = mid;
  if tavan is null then raise exception 'yetki yok'; end if;

  select least(tavan, greatest(0, coalesce((select taken from public.supplement_logs
                                             where supplement_id = p_supp and on_date = p_date), 0)
                                   + coalesce(p_delta, 1)))
    into yeni;

  if yeni <= 0 then
    delete from public.supplement_logs where supplement_id = p_supp and on_date = p_date;
    return 0;
  end if;

  insert into public.supplement_logs (supplement_id, on_date, member_id, taken)
  values (p_supp, p_date, mid, yeni)
  on conflict (supplement_id, on_date) do update set taken = excluded.taken;
  return yeni;
end $$;

revoke all on function public.my_supplements(uuid, date)            from public, anon;
revoke all on function public.supplement_take(uuid, uuid, int, date) from public, anon;
grant execute on function public.my_supplements(uuid, date)            to authenticated;
grant execute on function public.supplement_take(uuid, uuid, int, date) to authenticated;
