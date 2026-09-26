// lib/data/supabaseRepo.js — gerçek backend. Tüm iş mantığı DB'de; burada sadece sorgu + rpc.
// Faz 1'de tamamlanır (TASK_BOARD). Şu an ana yollar yazılı, kalanlar açıkça 'TODO' fırlatır.
import { getSupabase } from '../supabase.js';
import { expandRRule, addDays, nextOccasionDate, daysBetween, today } from '../dates.js';
import { readCache, writeCache, clearCache, isNetworkError } from './offlineCache.js';

let ctx = { household: null, members: [], me: null };
const sb = () => getSupabase();
const must = (res) => { if (res.error) throw res.error; return res.data; };
const hid = () => { if (!ctx.household) throw new Error('hane yüklenmedi'); return ctx.household.id; };
const todo = (name) => { throw new Error(`supabaseRepo.${name}: Faz 1'de tamamlanacak`); };

// İmzalı albüm adresi: 24 saat geçerli, cihazda 20 saat saklanır. Aynı
// fotoğraf her açılışta yeniden indirilmesin (mobil veri ve hız).
const URL_OMUR = 24 * 3600;
async function albumUrl(path, bucket = 'album') {
  const key = 'yuva:album-url:' + (bucket === 'album' ? '' : bucket + ':') + path;
  try {
    const c = JSON.parse(localStorage.getItem(key) || 'null');
    if (c && c.exp > Date.now()) return c.url;
  } catch { /* depo kapalı — önemsiz */ }
  const r = must(await sb().storage.from(bucket).createSignedUrl(path, URL_OMUR));
  try { localStorage.setItem(key, JSON.stringify({ url: r.signedUrl, exp: Date.now() + 20 * 3600 * 1000 })); } catch { /* önemsiz */ }
  return r.signedUrl;
}

export default function makeSupabaseRepo() {
  return {
    mode: 'supabase',
    /**
     * Açılış: TEK sorgu. Eskiden getUser + profiles + households +
     * household_members + accounts + categories + fx_rates diye sırayla
     * yedi gidiş-dönüş vardı; ekran o süre boyunca boş kalıyordu.
     * getSession() ağa çıkmaz (bellekteki JWT), app_bootstrap() gerisini
     * tek pakette döner (bkz. supabase/migrations/0004_bootstrap.sql).
     */
    async init() {
      const { data: { session } } = await sb().auth.getSession();
      const user = session?.user || null;
      if (!user) return { household: null, members: [], me: null };

      // Ağ yoksa son görülen hale düş (yalnızca okuma — bkz. offlineCache.js).
      // Yetki/sunucu hatasında DÜŞÜLMEZ: görülmemesi gereken veri ekranda
      // kalmasın.
      let b, stale = null;
      try {
        b = must(await sb().rpc('app_bootstrap'));
        if (b?.household) writeCache(user.id, 'bootstrap', b);
      } catch (e) {
        const cached = isNetworkError(e) ? readCache(user.id, 'bootstrap') : null;
        if (cached) { b = cached.data; stale = cached.ts; }
        else {
          // OTURUM KAYBEDİLMEZ. Eskiden burada hata fırlatılıyordu; çağıran
          // onu yakalayıp state'i boşaltıyor ve kullanıcı geçerli oturumu
          // varken ŞİFRE EKRANINA düşüyordu. Telefonda ağ bir saniye
          // kesildiğinde bile oluyordu. Artık kullanıcı korunur, hane boş
          // döner ve ekranda "bağlanılamadı, tekrar dene" çıkar.
          return { household: null, members: [], me: null, user, bootstrapFailed: true };
        }
      }
      if (!b || !b.household) return { household: null, members: [], me: null, user, bootstrapFailed: false };

      ctx = { household: b.household, members: b.members || [], me: b.me || null };
      const rates = {};
      for (const r of b.rates || []) rates[r.base + r.quote] = Number(r.rate);
      return { ...ctx, user, accounts: b.accounts || [], categories: b.categories || [], rates, stale, bootstrapFailed: false };
    },
    /**
     * Canlı yenileme (0009). Hanenin tablolarındaki her değişiklikte
     * onChange(tableName) çağrılır. Dönen fonksiyon aboneliği kapatır.
     * Realtime RLS'i uygular; misafire finansal olaylar gitmez.
     */
    subscribe(onChange, onStatus) {
      const client = sb();
      const h = hid();
      const ch = client.channel('yuva:' + h);
      const scoped = [
        'household_members', 'calendar_events', 'transactions', 'budgets',
        'recurring_rules', 'accounts', 'categories', 'plans', 'plan_items',
        'goal_contributions', 'occasions', 'documents', 'contacts', 'tasks',
        'shopping_lists', 'shopping_items', 'notifications',
      ];
      for (const table of scoped) {
        ch.on('postgres_changes',
          { event: '*', schema: 'public', table, filter: 'household_id=eq.' + h },
          () => onChange(table));
      }
      // households'ta süzgeç household_id değil id.
      ch.on('postgres_changes',
        { event: '*', schema: 'public', table: 'households', filter: 'id=eq.' + h },
        () => onChange('households'));
      // Kanal durumu kullanıcıya gösterilir: bağlantı kopukken ekrandaki veri
      // eskiyebilir ve yazma başarısız olur — bunu sessizce geçmek yanlış olur.
      ch.subscribe((status) => onStatus?.(status));
      return () => { try { client.removeChannel(ch); } catch { /* kapanışta önemsiz */ } };
    },
    backup: {
      // Tüm hane tek RPC'de (0012). Yetki kontrolü DB'de: yedek finansal
      // veriyi de içerdiği için yalnızca yetişkin alabilir.
      async exportAll() { return must(await sb().rpc('export_household', { hid: hid() })); },
      // Geri yükleme YENİ hane kurar; mevcut haneye dokunmaz (0018).
      async importAll(backup) { return must(await sb().rpc('import_household', { p_backup: backup })); },
    },
    household: {
      async get() { return ctx.household; },
      async update(patch) { const row = must(await sb().from('households').update(patch).eq('id', hid()).select().single()); ctx.household = row; return row; },
      // Katılım kodu artık süreli ve kullanım sınırlı (0007). Yeni kod üretmek
      // yetişkine özeldir; kural ve doğrulama rotate_join_code içinde.
      async rotateJoinCode({ role = 'adult', hours = 168, uses = 1 } = {}) {
        const code = must(await sb().rpc('rotate_join_code', { hid: hid(), p_role: role, p_hours: hours, p_uses: uses }));
        ctx.household = { ...ctx.household, join_code: code, join_code_role: role, join_code_uses_left: uses };
        return code;
      },
      // Geri yükleme yeni hane kurduğu için kullanıcının birden fazla hanesi
      // olabilir; açılışta hangisinin geleceği burada seçilir (0018).
      async list() { return must(await sb().rpc('my_households')); },
      async setDefault(id) { must(await sb().rpc('set_default_household', { hid: id })); },
    },
    members: {
      async list() { return must(await sb().from('household_members').select('*').eq('household_id', hid()).eq('is_active', true)); },
      async create(m) { return must(await sb().from('household_members').insert({ ...m, household_id: hid() }).select().single()); },
      async update(id, patch) { return must(await sb().from('household_members').update(patch).eq('id', id).select().single()); },
    },
    events: {
      async list({ from, to }) {
        const rows = must(await sb().from('calendar_events')
          .select('*, event_attendees(member_id)')
          .eq('household_id', hid())
          .or(`rrule.not.is.null,and(starts_at.gte.${from}T00:00:00,starts_at.lte.${to}T23:59:59)`));
        const out = [];
        for (const e of rows) {
          const attendees = (e.event_attendees || []).map((a) => a.member_id);
          const s = new Date(e.starts_at);
          const s0 = `${s.getFullYear()}-${String(s.getMonth() + 1).padStart(2, '0')}-${String(s.getDate()).padStart(2, '0')}`;
          for (const d of expandRRule(e.rrule, s0, from, to, e.exdates)) out.push({ ...e, attendees, date: d });
        }
        return out.sort((a, b) => (a.date + a.starts_at.slice(11)).localeCompare(b.date + b.starts_at.slice(11)));
      },
      async create({ attendees = [], ...e }) {
        const row = must(await sb().from('calendar_events').insert({ ...e, household_id: hid() }).select().single());
        if (attendees.length) must(await sb().from('event_attendees').insert(attendees.map((m) => ({ event_id: row.id, member_id: m }))));
        return { ...row, attendees };
      },
      async update(id, patch) { return must(await sb().from('calendar_events').update(patch).eq('id', id).select().single()); },
      async remove(id) { must(await sb().from('calendar_events').delete().eq('id', id)); },
      // Tekrarlayan olayda yalnızca o günü gizler; seri bozulmaz (0008).
      async skipOccurrence(id, date) { return must(await sb().rpc('event_skip_occurrence', { p_event_id: id, p_date: date })); },
    },
    accounts: {
      async list() { return must(await sb().from('accounts').select('*').eq('household_id', hid()).eq('is_archived', false).order('sort_order')); },
      async balances() { return must(await sb().from('account_balances').select('*').eq('household_id', hid())); },
      async create(a) { return must(await sb().from('accounts').insert({ ...a, household_id: hid() }).select().single()); },
    },
    categories: { async list() { return must(await sb().from('categories').select('*').eq('household_id', hid()).order('sort_order')); } },
    transactions: {
      async list({ period, limit = 200, planId } = {}) {
        let q = sb().from('transactions').select('*').eq('household_id', hid()).order('occurred_on', { ascending: false }).limit(limit);
        if (period) q = q.gte('occurred_on', period + '-01').lt('occurred_on', addDays(period + '-01', 32).slice(0, 7) + '-01');
        if (planId) q = q.eq('plan_id', planId);
        const rows = must(await q);
        if (planId) return rows;
        // Eşin kişisel harcamaları RLS ile gelmiyor; tutarı görünsün diye
        // maskeli halleri ayrı RPC'den ekleniyor (0029): nereye/kategori/not yok.
        const gizli = must(await sb().rpc('personal_masked', {
          hid: hid(),
          p_from: period ? period + '-01' : null,
          p_to: period ? addDays(period + '-01', 32).slice(0, 7) + '-01' : null,
        })) || [];
        return [...rows, ...gizli.map((x) => ({ ...x, masked: true }))]
          .sort((a, b) => String(b.occurred_on).localeCompare(String(a.occurred_on)))
          .slice(0, limit);
      },
      async create(t) { return must(await sb().from('transactions').insert({ ...t, household_id: hid(), paid_by_member_id: t.paid_by_member_id ?? ctx.me?.id }).select().single()); },
      async update(id, patch) { return must(await sb().from('transactions').update(patch).eq('id', id).select().single()); },
      async remove(id) {
        const eski = (await sb().from('transactions').select('receipt_path').eq('id', id).maybeSingle()).data?.receipt_path;
        must(await sb().from('transactions').delete().eq('id', id));
        // Fiş artık sahipsiz; silinmesine izin var (0031). Olmazsa önemsiz.
        if (eski) await sb().storage.from('fisler').remove([eski]);
      },
    },
    // FİŞ FOTOĞRAFI (0031). Önce işleme yol yazılıyor, sonra dosya yükleniyor:
    // okuma kuralı "bu yolu taşıyan, bana görünen işlem var mı" diye baktığı
    // için bağ önce kurulmalı. Yükleme olmazsa yol eski haline döner.
    receipts: {
      async url(path) { return albumUrl(path, 'fisler'); },
      async attach(txnId, file, oldPath) {
        const { kucult } = await import('../album.js');
        const { blob } = await kucult(file, 1800, 0.8);
        const path = `${hid()}/${txnId}-${crypto.randomUUID().slice(0, 8)}.jpg`;
        must(await sb().from('transactions').update({ receipt_path: path }).eq('id', txnId).select('id').single());
        try {
          must(await sb().storage.from('fisler').upload(path, blob, { contentType: 'image/jpeg', upsert: false }));
        } catch (e) {
          await sb().from('transactions').update({ receipt_path: oldPath || null }).eq('id', txnId);
          throw e;
        }
        if (oldPath) await sb().storage.from('fisler').remove([oldPath]);
        return path;
      },
      async remove(txnId, path) {
        must(await sb().from('transactions').update({ receipt_path: null }).eq('id', txnId).select('id').single());
        if (path) await sb().storage.from('fisler').remove([path]);
      },
    },
    budgets: {
      async list(period) { return must(await sb().from('budgets').select('*').eq('household_id', hid()).eq('period', period)); },
      // Kategorisiz (toplam) bütçede PostgREST upsert'i NULL çakışmasını yakalamaz ve
      // mükerrer satır oluşurdu; tekillik ve yetki DB'deki budget_set içinde çözülür.
      async set(b) { return must(await sb().rpc('budget_set', { hid: hid(), p_period: b.period, p_category_id: b.category_id ?? null, p_amount: b.amount_base })); },
      // Kişisel aylık limit (0027) — kişiye özel, her ay yeniden girilmez. 0 = kaldır.
      async setPersonalLimit(amount) { must(await sb().rpc('personal_limit_set', { hid: hid(), p_amount: amount || 0 })); },
      // Limitler aydan aya taşınıyor (0029): kaldırmak "bu aydan itibaren" demek;
      // geçmiş aylar olduğu gibi kalır.
      async remove(period, categoryId) {
        must(await sb().rpc('budget_remove', { hid: hid(), p_period: period, p_category_id: categoryId || null }));
      },
    },
    recurring: {
      async list() { return must(await sb().from('recurring_rules').select('*').eq('household_id', hid()).eq('is_active', true).order('next_due_on')); },
      async create(r) { return must(await sb().from('recurring_rules').insert({ ...r, household_id: hid() }).select().single()); },
      async update(id, patch) { return must(await sb().from('recurring_rules').update(patch).eq('id', id).select().single()); },
      async remove(id) { must(await sb().from('recurring_rules').update({ is_active: false }).eq('id', id)); },
      // Ödendi: harcama yazılır, vade ilerler (0033, tek işlem).
      async pay(id, opts = {}) {
        return must(await sb().rpc('bill_pay', { hid: hid(), p_rule: id, p_date: opts.date || null,
          p_amount: opts.amount ?? null, p_account: opts.accountId || null }));
      },
      async skip(id) { return must(await sb().rpc('bill_skip', { hid: hid(), p_rule: id })); },
    },
    plans: {
      async list() { return must(await sb().from('plans').select('*').eq('household_id', hid()).order('starts_on')); },
      async get(id) { return must(await sb().from('plans').select('*').eq('id', id).single()); },
      async items(planId) { return must(await sb().from('plan_items').select('*').eq('plan_id', planId).order('sort_order')); },
      async create(p) { return must(await sb().from('plans').insert({ ...p, household_id: hid() }).select().single()); },
      async update(id, patch) { return must(await sb().from('plans').update(patch).eq('id', id).select().single()); },
      async addItem(i) { return must(await sb().from('plan_items').insert({ ...i, household_id: hid() }).select().single()); },
      async updateItem(id, patch) { return must(await sb().from('plan_items').update(patch).eq('id', id).select().single()); },
      // Masraf kalemi silinince bağlı harcaması da silinir (0028, tetik).
      async removeItem(id) { must(await sb().from('plan_items').delete().eq('id', id)); },
      // Plan silinince kalemleri gider; ödenmiş harcamalar Bütçe'de kalır (0028).
      async remove(id) { must(await sb().from('plans').delete().eq('id', id)); },
      async contributions(planId) { return must(await sb().from('goal_contributions').select('*').eq('plan_id', planId).order('on_date', { ascending: false })); },
      // amount_base ve fx_rate tetikleyicide doldurulur (0006); ön yüz göndermez.
      async addContribution(c) { return must(await sb().from('goal_contributions').insert({ ...c, household_id: hid() }).select().single()); },
    },
    occasions: {
      async list() {
        const rows = must(await sb().from('occasions').select('*').eq('household_id', hid()));
        return rows.map((o) => ({ ...o, ...nextOccasionDate(o.month, o.day) })).sort((a, b) => a.daysLeft - b.daysLeft);
      },
      async create(o) { return must(await sb().from('occasions').insert({ ...o, household_id: hid() }).select().single()); },
    },
    documents: {
      async list() {
        const rows = must(await sb().from('documents').select('*').eq('household_id', hid()).order('expires_on'));
        const T = today();
        return rows.map((d) => ({ ...d, daysLeft: d.expires_on ? daysBetween(T, d.expires_on) : null }));
      },
      async create(d) { return must(await sb().from('documents').insert({ ...d, household_id: hid() }).select().single()); },
    },
    tasks: {
      async list() { return must(await sb().from('tasks').select('*').eq('household_id', hid()).order('is_done').order('due_on')); },
      async create(t) { return must(await sb().from('tasks').insert({ ...t, household_id: hid() }).select().single()); },
      async update(id, patch) { return must(await sb().from('tasks').update(patch).eq('id', id).select().single()); },
      // Tekrarlayan görevde nextDue verilir: görev bitmiş sayılmaz, vadesi
      // sonraki tekrara taşınır. Tamamlama her iki halde de kaydedilir (0010).
      async complete(id, nextDue = null) { return must(await sb().rpc('task_complete', { p_task_id: id, p_next_due: nextDue })); },
      async uncomplete(id) { return must(await sb().rpc('task_uncomplete', { p_task_id: id })); },
      async postpone(id, days = 1) { return must(await sb().rpc('task_postpone', { p_task_id: id, p_days: days })); },
      async skip(id, nextDue) { return must(await sb().rpc('task_skip', { p_task_id: id, p_next_due: nextDue })); },
      async completions(from) {
        let q = sb().from('task_completions').select('*').eq('household_id', hid()).order('done_on', { ascending: false });
        if (from) q = q.gte('done_on', from);
        return must(await q);
      },
    },
    shopping: {
      async lists() { return must(await sb().from('shopping_lists').select('*').eq('household_id', hid()).eq('is_archived', false)); },
      async items(listId) { let q = sb().from('shopping_items').select('*').eq('household_id', hid()).order('created_at'); if (listId) q = q.eq('list_id', listId); return must(await q); },
      // list_id NOT NULL; hızlı eklemede geçilmiyordu ve insert hata veriyordu.
      // Varsayılan liste DB'de çözülür, iki giriş yolu aynı davranır (0016).
      // catalog_key verilirse favori sayacı DB'de artar (0019).
      async addItem(i) {
        return must(await sb().rpc('shopping_add_item', {
          p_name: i.name, p_list_id: i.list_id ?? null, p_qty: i.qty ?? null,
          p_catalog_key: i.catalog_key ?? null,
        }));
      },
      async favorites(limit = 12) { return must(await sb().rpc('shopping_favorites_top', { p_limit: limit })); },
      // Harcama + işaretlileri temizleme tek işlemde; ikincisi patlarsa aynı
      // alışveriş ikinci kez harcamaya çevrilebiliyordu (0016).
      async checkout(listId, txn) { return must(await sb().rpc('shopping_checkout', { p_list_id: listId, p_txn: txn })); },
      async toggleItem(id) {
        const cur = must(await sb().from('shopping_items').select('is_checked').eq('id', id).single());
        return must(await sb().from('shopping_items').update({ is_checked: !cur.is_checked }).eq('id', id).select().single());
      },
      async clearChecked(listId) { must(await sb().from('shopping_items').delete().eq('list_id', listId).eq('is_checked', true)); },
      // Hızlı seçimde ürüne ikinci kez dokunmak onu listeden çıkarır.
      async removeItem(id) { must(await sb().from('shopping_items').delete().eq('id', id)); },
    },
    notifications: {
      // all=true okunmuşları da getirir (bildirim merkezi geçmişi).
      async list({ all = false, limit = 50 } = {}) {
        let q = sb().from('notifications').select('*').eq('household_id', hid()).order('fire_at', { ascending: false }).limit(limit);
        if (!all) q = q.is('read_at', null);
        return must(await q);
      },
      async markRead(id) { must(await sb().from('notifications').update({ read_at: new Date().toISOString() }).eq('id', id)); },
      async markAllRead() { must(await sb().from('notifications').update({ read_at: new Date().toISOString() }).eq('household_id', hid()).is('read_at', null)); },
    },
    summary: {
      /** Bugün ekranının tamamı tek çağrıda (0004_bootstrap.sql). */
      async today(from, days, period) {
        const ck = `today|${from}|${days}|${period}`;
        const uid = ctx.me?.user_id || ctx.household?.id;
        let s;
        try {
          s = must(await sb().rpc('today_snapshot', { hid: hid(), p_from: from, p_days: days, p_period: period }));
          writeCache(uid, ck, s);
        } catch (e) {
          const cached = isNetworkError(e) ? readCache(uid, ck) : null;
          if (!cached) throw e;
          s = cached.data;
        }
        const to = addDays(from, days);
        const events = [];
        for (const e of s.agenda?.events || []) {
          const d0 = new Date(e.starts_at);
          const s0 = `${d0.getFullYear()}-${String(d0.getMonth() + 1).padStart(2, '0')}-${String(d0.getDate()).padStart(2, '0')}`;
          for (const d of expandRRule(e.rrule, s0, from, to, e.exdates)) events.push({ ...e, attendees: [], date: d });
        }
        return {
          agenda: {
            events,
            occasions: (s.agenda?.occasions || []).map((o) => ({ ...o, ...nextOccasionDate(o.month, o.day, from) })),
            bills: s.agenda?.bills || [],
            documents: (s.agenda?.documents || []).map((d) => ({ ...d, daysLeft: daysBetween(from, d.expires_on) })),
            tasks: s.agenda?.tasks || [],
          },
          month: s.month,
          budget: s.budget || [],
          shopping: s.shopping || [],
          notifs: s.notifications || [],
        };
      },
      async month(period) { return must(await sb().rpc('month_summary', { hid: hid(), p_period: period })); },
      async budgetStatus(period) { return must(await sb().rpc('budget_status', { hid: hid(), p_period: period })); },
      /** Çok aylık eğilim (0020). Pencere p_period'da biter. */
      async trend(period, months = 6, scope = 'family') { return must(await sb().rpc('month_trend', { hid: hid(), p_period: period, p_months: months, p_scope: scope })); },
      async agenda(from, days) {
        const raw = must(await sb().rpc('upcoming_agenda', { hid: hid(), p_from: from, p_days: days }));
        const to = addDays(from, days);
        const events = [];
        for (const e of raw.events || []) {
          const s = new Date(e.starts_at);
          const s0 = `${s.getFullYear()}-${String(s.getMonth() + 1).padStart(2, '0')}-${String(s.getDate()).padStart(2, '0')}`;
          for (const d of expandRRule(e.rrule, s0, from, to, e.exdates)) events.push({ ...e, attendees: [], date: d });
        }
        return {
          events,
          occasions: (raw.occasions || []).map((o) => ({ ...o, ...nextOccasionDate(o.month, o.day, from) })),
          bills: raw.bills || [],
          documents: (raw.documents || []).map((d) => ({ ...d, daysLeft: daysBetween(from, d.expires_on) })),
          tasks: raw.tasks || [],
        };
      },
    },
    /**
     * KİŞİSEL — hane ortak verisi DEĞİL (0021). Diğer üye göremez; sınır
     * veritabanında, üye düzeyinde RLS ile kurulu. Gerçek `authenticated`
     * rolüyle sınandı: eşin sorgusu 0 satır dönüyor.
     */
    personal: {
      async day(date) { return must(await sb().rpc('my_day', { hid: hid(), p_date: date || today() })); },
      async goals(date) { return must(await sb().rpc('my_goals', { hid: hid(), p_date: date || today() })); },
      async toggleBlock(id, date) { return must(await sb().rpc('block_toggle', { hid: hid(), p_block: id, p_date: date || today() })); },
      async setGoal(id, amount, date) { return must(await sb().rpc('goal_log_set', { hid: hid(), p_goal: id, p_amount: amount, p_date: date || today() })); },
      async blocks(scope) {
        return must(await sb().from('day_blocks').select('*')
          .eq('member_id', ctx.me?.id).eq('scope', scope).order('starts_at'));
      },
      async addBlock(b) {
        return must(await sb().from('day_blocks')
          .insert({ ...b, household_id: hid(), member_id: ctx.me?.id }).select().single());
      },
      async removeBlock(id) { must(await sb().from('day_blocks').delete().eq('id', id)); },
      async updateBlock(id, patch) { return must(await sb().from('day_blocks').update(patch).eq('id', id).select().single()); },
      async addGoal(g) {
        return must(await sb().from('goals')
          .insert({ ...g, household_id: hid(), member_id: ctx.me?.id }).select().single());
      },
      async removeGoal(id) { must(await sb().from('goals').update({ is_active: false }).eq('id', id)); },
      // TAKVİYELER (0022) — kişisel; RLS üye düzeyinde.
      async supplements(date) { return must(await sb().rpc('my_supplements', { hid: hid(), p_date: date || today() })); },
      async takeSupplement(id, delta, date) {
        return must(await sb().rpc('supplement_take', { hid: hid(), p_supp: id, p_delta: delta ?? 1, p_date: date || today() }));
      },
      async addSupplement(s) {
        return must(await sb().from('supplements')
          .insert({ ...s, household_id: hid(), member_id: ctx.me?.id }).select().single());
      },
      // Silmiyoruz, pasife alıyoruz: geçmiş günlerin kayıtları dursun.
      async removeSupplement(id) { must(await sb().from('supplements').update({ is_active: false }).eq('id', id)); },
    },
    /**
     * AİLE ALBÜMÜ (0023). Dosyalar özel bucket'ta; ekran imzalı adresle
     * gösteriyor. İmzalı adres her istekte değişir ve tarayıcı onu yeni bir
     * resim sanıp yeniden indirir; bu yüzden adres süresi dolana kadar
     * cihazda saklanıp yeniden kullanılıyor (albumUrl).
     */
    album: {
      async photoOfDay(date) {
        try {
          const r = must(await sb().rpc('photo_of_day', { hid: hid(), p_date: date || today() }));
          if (!r || !r.count || !r.path) return { count: r?.count || 0 };
          return { ...r, url: await albumUrl(r.path) };
        } catch {
          // Albüm okunamazsa Bugün ekranı bozulmasın: çizim gösterilir.
          return { count: 0 };
        }
      },
      async list() {
        const rows = must(await sb().from('album_photos').select('*').order('created_at'));
        return Promise.all(rows.map(async (r) => ({ ...r, url: await albumUrl(r.path) })));
      },
      async upload(file) {
        const { kucult } = await import('../album.js');
        const { blob, width, height } = await kucult(file);
        const path = `${hid()}/${crypto.randomUUID()}.jpg`;
        must(await sb().storage.from('album').upload(path, blob, { contentType: 'image/jpeg', upsert: false }));
        try {
          return must(await sb().from('album_photos')
            .insert({ household_id: hid(), path, width, height, added_by: ctx.me?.id }).select().single());
        } catch (e) {
          // Satır yazılamadıysa dosya sahipsiz kalmasın.
          await sb().storage.from('album').remove([path]);
          throw e;
        }
      },
      async remove(id) {
        const row = must(await sb().from('album_photos').select('path').eq('id', id).single());
        must(await sb().from('album_photos').delete().eq('id', id));
        // Önce satır: dosya silinemezse en kötü ihtimalle görünmeyen bir dosya
        // kalır; tersi olsaydı ekranda kırık resim kalırdı.
        await sb().storage.from('album').remove([row.path]);
      },
    },
    /**
     * TELEFONA BİLDİRİM (0026). Zamanlama ve gönderim sunucuda; burada
     * abonelik, tercih ve "deneme bildirimi" var. Deneme kuyruğa yazılıp
     * gönderici hemen dürtülüyor ki dakikalık zamanlayıcı beklenmesin.
     */
    push: {
      async vapidKey() { return must(await sb().rpc('push_vapid_public')); },
      async subscribe(sub, ua) {
        must(await sb().rpc('push_subscribe', {
          hid: hid(), p_endpoint: sub.endpoint, p_p256dh: sub.keys?.p256dh, p_auth: sub.keys?.auth, p_ua: ua || null,
        }));
      },
      async unsubscribe(endpoint) { must(await sb().rpc('push_unsubscribe', { p_endpoint: endpoint })); },
      async prefs() { return must(await sb().rpc('notify_prefs_get', { hid: hid() })); },
      async setPrefs(p) { must(await sb().rpc('notify_prefs_set', { hid: hid(), p })); },
      // Pazar akşamı gelecek özetin şu anki hali (0030).
      async weeklyPreview() { return must(await sb().rpc('weekly_digest_preview', { hid: hid() })); },
      // Geçen ayın özeti — ayın 1'inde gelecek bildirimin içeriği (0034).
      async monthlyPreview(period) { return must(await sb().rpc('monthly_digest_preview', { hid: hid(), p_period: period || null })); },
      async test(title, body) {
        const n = must(await sb().rpc('push_test', { hid: hid(), p_title: title, p_body: body }));
        try { await sb().functions.invoke('push-send', { body: {} }); } catch { /* zamanlayıcı bir dakika içinde gönderir */ }
        return n;
      },
    },
    /** AKILLI ÖNERİLER (0024). Hesap veritabanında; burada yalnızca çağrı. */
    suggest: {
      async expenses(date) {
        try { return must(await sb().rpc('expense_suggestions', { hid: hid(), p_date: date || today(), p_limit: 4 })) || []; }
        catch { return []; }   // öneri yoksa ekran eksiksiz çalışmaya devam eder
      },
      async restock(date) {
        try { return must(await sb().rpc('restock_suggestions', { hid: hid(), p_date: date || today(), p_limit: 6 })) || []; }
        catch { return []; }
      },
    },
    fx: {
      async rates() {
        const rows = must(await sb().from('fx_rates').select('*').order('rate_date', { ascending: false }).limit(50));
        const map = {};
        for (const r of rows) if (!map[r.base + r.quote]) map[r.base + r.quote] = Number(r.rate);
        return map;
      },
    },
    auth: {
      // E-posta + sifre. Sihirli baglanti bilincli olarak kullanilmiyor:
      // iki kisilik bir hanede her giriste e-posta beklemek gereksiz surtunme.
      async signIn(email, password) {
        must(await sb().auth.signInWithPassword({ email, password }));
      },
      async signUp(email, password) {
        const data = must(await sb().auth.signUp({ email, password }));
        // Supabase e-posta sayimini engellemek icin var olan hesapta da basarili
        // gibi doner; ayirt edici isaret identities dizisinin bos olmasi.
        if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
          throw new Error('User already registered');
        }
        // Oturum yoksa "Confirm email" hala acik demektir.
        if (!data.session) throw new Error('Email not confirmed');
      },
      async changePassword(password) { must(await sb().auth.updateUser({ password })); },
      // Önbellek de silinir: aynı cihazda başka biri giriş yaparsa öncekinin
      // hane verisini görmemeli.
      async signOut() { clearCache(); await sb().auth.signOut(); ctx = { household: null, members: [], me: null }; },
      async createHousehold({ name, base_currency, timezone, display_name, locale }) {
        return must(await sb().rpc('create_household', { p_name: name, p_base_currency: base_currency, p_timezone: timezone, p_display_name: display_name, p_locale: locale || 'tr' }));
      },
      async joinHousehold(code, display_name) { return must(await sb().rpc('join_household', { p_code: code, p_display_name: display_name })); },
    },
    reset() { todo('reset'); },
  };
}
