-- 0016 — Alışverişte iki hata (dış incelemede bulundu)
--
-- 1. HIZLI EKLEME ÇALIŞMIYORDU.
--    `shopping_items.list_id` NOT NULL. Liste ekranından eklerken liste kimliği
--    geçiliyor, ama Bugün ekranından ve "+" menüsünden eklerken geçilmiyordu.
--    Demo modda sorun görünmüyordu çünkü demoRepo ilk listeyi kendisi seçiyor;
--    gerçek veritabanında insert hata veriyordu. İki giriş yolu aynı davranmalı.
--    Çözüm: liste kimliği verilmezse hanenin varsayılan listesi DB'de çözülür.
--
-- 2. ALIŞVERİŞİ HARCAMAYA ÇEVİRME ATOMİK DEĞİLDİ.
--    Önce harcama kaydediliyor, sonra ayrı bir çağrıyla işaretli kalemler
--    siliniyordu. İkincisi başarısız olursa (bağlantı kopması yeter) kalemler
--    işaretli kalıyor ve kullanıcı aynı alışverişi ikinci kez harcamaya
--    çevirebiliyordu — çift kayıt. İkisi tek işlemde yapılır.

-- Hanenin varsayılan alışveriş listesi; yoksa oluşturur.
-- 0005 yeni hanelere liste açıyor, ama eski haneler ve listenin silindiği
-- durum için burada da güvence var.
create or replace function public.shopping_default_list(hid uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  select id into v_id from public.shopping_lists
   where household_id = hid and not is_archived
   order by created_at limit 1;

  if v_id is null then
    insert into public.shopping_lists (household_id, name, icon)
    values (hid, 'Market', '🛒') returning id into v_id;
  end if;

  return v_id;
end $$;

create or replace function public.shopping_add_item(
  p_name text, p_list_id uuid default null, p_qty text default null)
returns public.shopping_items language plpgsql security definer set search_path = public as $$
declare v_hid uuid; v_list uuid; out_row public.shopping_items;
begin
  if p_list_id is not null then
    select household_id into v_hid from public.shopping_lists where id = p_list_id;
    v_list := p_list_id;
  else
    -- Kullanıcının varsayılan hanesi üzerinden çöz.
    select hm.household_id into v_hid
      from public.household_members hm
      left join public.profiles pr on pr.user_id = hm.user_id
     where hm.user_id = auth.uid() and hm.is_active
     order by (hm.household_id = pr.default_household_id) desc, hm.created_at
     limit 1;
    if v_hid is null then raise exception 'hane bulunamadı'; end if;
    v_list := public.shopping_default_list(v_hid);
  end if;

  if not public.is_household_member(v_hid) then raise exception 'yetki yok'; end if;

  insert into public.shopping_items (household_id, list_id, name, qty, added_by_member_id)
  values (v_hid, v_list, p_name, p_qty, public.my_member_id(v_hid))
  returning * into out_row;

  return out_row;
end $$;

-- Harcama + işaretli kalemlerin temizlenmesi TEK işlemde.
-- p_txn alanları ExpenseForm'un ürettiği satırla birebir aynı.
create or replace function public.shopping_checkout(p_list_id uuid, p_txn jsonb)
returns public.transactions language plpgsql security definer set search_path = public as $$
declare v_hid uuid; out_row public.transactions;
begin
  select household_id into v_hid from public.shopping_lists where id = p_list_id;
  if v_hid is null then raise exception 'liste bulunamadı'; end if;
  if not public.can_see_money(v_hid) then raise exception 'yetki yok'; end if;

  insert into public.transactions (
    household_id, kind, account_id, transfer_account_id, amount, currency,
    category_id, merchant, for_member_id, paid_by_member_id, occurred_on, note)
  values (
    v_hid,
    coalesce((p_txn->>'kind')::txn_kind, 'expense'),
    (p_txn->>'account_id')::uuid,
    nullif(p_txn->>'transfer_account_id','')::uuid,
    (p_txn->>'amount')::numeric,
    p_txn->>'currency',
    nullif(p_txn->>'category_id','')::uuid,
    nullif(p_txn->>'merchant',''),
    nullif(p_txn->>'for_member_id','')::uuid,
    public.my_member_id(v_hid),
    coalesce((p_txn->>'occurred_on')::date, current_date),
    nullif(p_txn->>'note',''))
  returning * into out_row;

  delete from public.shopping_items
   where list_id = p_list_id and is_checked;

  return out_row;
end $$;

revoke all on function public.shopping_default_list(uuid) from public;
revoke all on function public.shopping_add_item(text, uuid, text) from public;
revoke all on function public.shopping_checkout(uuid, jsonb) from public;
grant execute on function public.shopping_add_item(text, uuid, text) to authenticated;
grant execute on function public.shopping_checkout(uuid, jsonb) to authenticated;
