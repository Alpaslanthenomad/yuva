-- 0036 — Anlık limit uyarısı
--
-- İSTEK (öneri 6): "Bir harcama bir limitin %80'ini geçirdiği anda bildirim
-- gelsin."
--
-- Harcama YAZILDIĞI anda (insert) o ayın ilgili limitleri kontrol edilir:
--   • Aile harcaması → o kategorinin (üst kategori) limiti ve toplam limit.
--     Uyarı parayı görebilen yetişkinlere gider.
--   • Kişisel harcama → sahibinin kişisel limiti; uyarı yalnızca ona gider.
-- Eşik: %80 ve %100. Yalnızca eşik BU harcamayla geçildiyse gönderilir
-- (önce altındaydı, şimdi üstünde) ve her eşik ayda bir kez (dedupe).
-- Limit bulma kuralı 0029'daki gibi: dönemi <= o ay olan en son ayar.
-- Tercih: notify_prefs.digest ("Sabah özeti ve uyarılar").

create or replace function public.limit_uyari()
returns trigger language plpgsql security definer set search_path = public as $$
declare per text; d1 date; d2 date; ust uuid; lim record; harcanan numeric; once numeric;
        esik int; m record; baslik text; es boolean; hloc text; ccy text; plim numeric;
begin
  if new.kind <> 'expense' or coalesce(new.amount_base, 0) <= 0 then return new; end if;
  per := to_char(new.occurred_on, 'YYYY-MM');
  d1 := to_date(per || '-01', 'YYYY-MM-DD');
  d2 := (d1 + interval '1 month')::date;
  -- Geçmiş aylara girilen harcama için uyarı anlamsız.
  if per < to_char(current_date - 3, 'YYYY-MM') then return new; end if;
  select coalesce(locale, 'tr'), base_currency into hloc, ccy from public.households where id = new.household_id;

  if new.for_member_id is null then
    select coalesce(c.parent_id, c.id) into ust from public.categories c where c.id = new.category_id;
    for lim in
      select distinct on (b.category_id) b.category_id, b.amount_base
        from public.budgets b
       where b.household_id = new.household_id and b.period <= per
         and (b.category_id is null or b.category_id = ust)
       order by b.category_id, b.period desc
    loop
      continue when coalesce(lim.amount_base, 0) <= 0;
      select coalesce(sum(t.amount_base), 0) into harcanan
        from public.transactions t
        left join public.categories cc on cc.id = t.category_id
       where t.household_id = new.household_id and t.kind = 'expense' and t.for_member_id is null
         and t.occurred_on >= d1 and t.occurred_on < d2
         and (lim.category_id is null or coalesce(cc.parent_id, cc.id) = lim.category_id);
      once := harcanan - new.amount_base;
      esik := case when once < lim.amount_base and harcanan >= lim.amount_base then 100
                   when once < 0.8 * lim.amount_base and harcanan >= 0.8 * lim.amount_base then 80 end;
      continue when esik is null;
      for m in
        select hm.id, coalesce(hm.locale, hloc) like 'es%' as es
          from public.household_members hm
          left join public.notify_prefs p on p.member_id = hm.id
         where hm.household_id = new.household_id and hm.is_active and hm.user_id is not null
           and hm.role = 'adult' and coalesce(p.digest, true)
      loop
        es := m.es;
        baslik := coalesce((select name from public.categories where id = lim.category_id),
                           case when es then 'Presupuesto total' else 'Toplam bütçe' end);
        perform public.push_enqueue(m.id,
          case when esik = 100 then '🚨 ' else '⚠️ ' end || baslik || ': %' || round(100 * harcanan / lim.amount_base),
          public.para_yaz(harcanan, ccy) || ' / ' || public.para_yaz(lim.amount_base, ccy)
            || case when esik = 100 then (case when es then ' · límite superado' else ' · limit aşıldı' end)
                    else (case when es then ' · quedan ' else ' · kalan ' end) || public.para_yaz(lim.amount_base - harcanan, ccy) end,
          '/para/?sekme=budgets', 'bw-' || coalesce(lim.category_id::text, 'toplam'),
          'bw:' || coalesce(lim.category_id::text, 'toplam') || ':' || per || ':' || esik, now());
      end loop;
    end loop;
  else
    select amount_base into plim from public.personal_limits where member_id = new.for_member_id;
    if coalesce(plim, 0) > 0 then
      select coalesce(sum(amount_base), 0) into harcanan from public.transactions
       where household_id = new.household_id and kind = 'expense' and for_member_id = new.for_member_id
         and occurred_on >= d1 and occurred_on < d2;
      once := harcanan - new.amount_base;
      esik := case when once < plim and harcanan >= plim then 100
                   when once < 0.8 * plim and harcanan >= 0.8 * plim then 80 end;
      if esik is not null and exists (select 1 from public.household_members hm
                                        left join public.notify_prefs p on p.member_id = hm.id
                                       where hm.id = new.for_member_id and coalesce(p.digest, true)) then
        select coalesce(hm.locale, hloc) like 'es%' into es from public.household_members hm where hm.id = new.for_member_id;
        perform public.push_enqueue(new.for_member_id,
          case when esik = 100 then '🚨 ' else '⚠️ ' end
            || case when es then 'Tu límite personal: %' else 'Kişisel limitin: %' end || round(100 * harcanan / plim),
          public.para_yaz(harcanan, ccy) || ' / ' || public.para_yaz(plim, ccy),
          '/para/', 'bw-kisisel', 'bw:kisisel:' || per || ':' || esik, now());
      end if;
    end if;
  end if;
  return new;
end $$;
revoke all on function public.limit_uyari() from public, anon, authenticated;

drop trigger if exists transactions_limit_uyari on public.transactions;
create trigger transactions_limit_uyari after insert on public.transactions
  for each row execute function public.limit_uyari();
