-- 0028 — Plan masrafları kendiliğinden harcamaya düşer
--
-- İSTEK: "Planlarda yaptığımız şeye harcama da ekleyebilmeliyiz ve otomatik
-- olarak harcamalara düşmeli. Örnek: Mark'ların evine misafirliğe gidiyoruz,
-- pasta götüreceğiz, ücret X. Ya da spor aktivitesine gidiyoruz, ödemesi
-- 10 bin peso."
--
-- MODEL: masraf, tutarı olan bir plan kalemidir (plan_items.amount dolu).
--   • Ödendi işaretliyse (is_done) karşılığında BİR harcama kaydı vardır;
--     tetikleyici onu yazar, plan_items.transaction_id ile bağlar.
--   • İşaret kaldırılırsa harcama silinir — "aslında henüz ödemedik".
--   • Tutar/başlık değişirse bağlı harcama da güncellenir.
--   • Masraf kalemi silinirse bağlı harcaması da silinir; PLAN silinirse
--     ödenmiş harcamalar durur (para gerçekten harcandı).
--   • Harcama Bütçe'den silinirse kalem "ödenmedi"ye döner (bağ kopar,
--     kalem durur) — iki ekran birbirini yalanlamasın.
--   • Harcama aile harcamasıdır (for_member_id boş) ve plan_id taşır; yani
--     planın "gerçekleşen" toplamına ve Bütçe'ye aynı anda düşer.
--
-- Hesap: kalemde seçilmişse o, değilse hanenin ilk hesabı. Tarih: kalemin
-- günü varsa o, yoksa işaretlendiği gün (ödeme anı).

alter table public.plan_items add column if not exists category_id    uuid references public.categories(id)   on delete set null;
alter table public.plan_items add column if not exists account_id     uuid references public.accounts(id)     on delete set null;
alter table public.plan_items add column if not exists transaction_id uuid;
-- Bağ ERTELENMİŞ denetleniyor: kalem "ödenmedi"ye çekilirken tetikleyici önce
-- harcamayı siliyor, kalemin bağı aynı komutun sonunda boşalıyor. Anında
-- denetimde (ya da 'on delete set null' ile) aynı satır iki kez değişmiş
-- sayılıp komut reddediliyordu — canlı testte yakalandı.
alter table public.plan_items drop constraint if exists plan_items_transaction_id_fkey;
alter table public.plan_items add constraint plan_items_transaction_id_fkey
  foreign key (transaction_id) references public.transactions(id) on delete no action deferrable initially deferred;

create or replace function public.plan_item_masraf()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_acc uuid; v_ccy char(3); v_txn uuid; odenmis boolean;
begin
  odenmis := new.is_done and coalesce(new.amount, 0) > 0;

  -- Ödenmedi (ya da tutar kalktı): bağlı harcama varsa kaldır.
  if not odenmis then
    if new.transaction_id is not null then
      v_txn := new.transaction_id;
      new.transaction_id := null;
      -- Bayrak: aşağıdaki "harcama silinince kalemi çöz" tetiği, şu an
      -- güncellenmekte olan bu kaleme ikinci kez dokunmasın.
      perform set_config('yuva.masraf_siliyor', '1', true);
      delete from public.transactions where id = v_txn;
      perform set_config('yuva.masraf_siliyor', '', true);
    end if;
    return new;
  end if;

  -- Ödendi ve zaten bağlı harcama var: tutar/başlık/kategori değiştiyse güncelle.
  if new.transaction_id is not null then
    update public.transactions
       set amount = new.amount, merchant = new.title,
           category_id = coalesce(new.category_id, category_id),
           currency = coalesce(new.currency, currency)
     where id = new.transaction_id;
    return new;
  end if;

  -- Ödendi, henüz harcama yok: yaz.
  select a.id, a.currency into v_acc, v_ccy
    from public.accounts a
   where a.household_id = new.household_id
     and (new.account_id is null or a.id = new.account_id)
   order by (a.id = new.account_id) desc nulls last, a.created_at
   limit 1;
  if v_acc is null then raise exception 'hesap yok'; end if;

  insert into public.transactions (household_id, kind, account_id, amount, currency, occurred_on,
                                   category_id, merchant, plan_id, paid_by_member_id, created_by)
  values (new.household_id, 'expense', v_acc, new.amount, coalesce(new.currency, v_ccy),
          coalesce(new.on_date, current_date), new.category_id, new.title, new.plan_id,
          public.my_member_id(new.household_id), auth.uid())
  returning id into v_txn;
  new.transaction_id := v_txn;
  new.account_id := coalesce(new.account_id, v_acc);
  new.currency := coalesce(new.currency, v_ccy);
  return new;
end $$;

drop trigger if exists plan_items_masraf on public.plan_items;
create trigger plan_items_masraf
  before insert or update of is_done, amount, title, category_id, currency on public.plan_items
  for each row execute function public.plan_item_masraf();

-- Kalem tek başına silindiyse harcaması da gider. Plan komple silindiyse
-- (kalemler zincirleme siliniyor) ödenmiş harcamalar DURUR: para gerçekten
-- harcandı; planı temizlemek bütçe geçmişini silmemeli.
create or replace function public.plan_item_masraf_sil()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if old.transaction_id is not null
     and exists (select 1 from public.plans where id = old.plan_id) then
    perform set_config('yuva.masraf_siliyor', '1', true);
    delete from public.transactions where id = old.transaction_id;
    perform set_config('yuva.masraf_siliyor', '', true);
  end if;
  return old;
end $$;
drop trigger if exists plan_items_masraf_sil on public.plan_items;
create trigger plan_items_masraf_sil after delete on public.plan_items
  for each row execute function public.plan_item_masraf_sil();

-- Harcama Bütçe'den silinirse kalem "ödenmedi"ye döner.
create or replace function public.transaction_plan_item_coz()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if coalesce(current_setting('yuva.masraf_siliyor', true), '') = '1' then return old; end if;
  update public.plan_items set transaction_id = null, is_done = false
   where transaction_id = old.id;
  return old;
end $$;
drop trigger if exists transactions_plan_item_coz on public.transactions;
create trigger transactions_plan_item_coz before delete on public.transactions
  for each row execute function public.transaction_plan_item_coz();

revoke all on function public.plan_item_masraf()          from public, anon, authenticated;
revoke all on function public.plan_item_masraf_sil()      from public, anon, authenticated;
revoke all on function public.transaction_plan_item_coz() from public, anon, authenticated;
