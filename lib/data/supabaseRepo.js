// lib/data/supabaseRepo.js — gerçek backend. Tüm iş mantığı DB'de; burada sadece sorgu + rpc.
// Faz 1'de tamamlanır (TASK_BOARD). Şu an ana yollar yazılı, kalanlar açıkça 'TODO' fırlatır.
import { getSupabase } from '../supabase.js';
import { expandRRule, addDays, nextOccasionDate, daysBetween, today } from '../dates.js';

let ctx = { household: null, members: [], me: null };
const sb = () => getSupabase();
const must = (res) => { if (res.error) throw res.error; return res.data; };
const hid = () => { if (!ctx.household) throw new Error('hane yüklenmedi'); return ctx.household.id; };
const todo = (name) => { throw new Error(`supabaseRepo.${name}: Faz 1'de tamamlanacak`); };

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

      const b = must(await sb().rpc('app_bootstrap'));
      if (!b || !b.household) return { household: null, members: [], me: null, user };

      ctx = { household: b.household, members: b.members || [], me: b.me || null };
      const rates = {};
      for (const r of b.rates || []) rates[r.base + r.quote] = Number(r.rate);
      return { ...ctx, user, accounts: b.accounts || [], categories: b.categories || [], rates };
    },
    /**
     * Canlı yenileme (0009). Hanenin tablolarındaki her değişiklikte
     * onChange(tableName) çağrılır. Dönen fonksiyon aboneliği kapatır.
     * Realtime RLS'i uygular; misafire finansal olaylar gitmez.
     */
    subscribe(onChange) {
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
      ch.subscribe();
      return () => { try { client.removeChannel(ch); } catch { /* kapanışta önemsiz */ } };
    },
    backup: {
      // Tüm hane tek RPC'de (0012). Yetki kontrolü DB'de: yedek finansal
      // veriyi de içerdiği için yalnızca yetişkin alabilir.
      async exportAll() { return must(await sb().rpc('export_household', { hid: hid() })); },
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
        return must(await q);
      },
      async create(t) { return must(await sb().from('transactions').insert({ ...t, household_id: hid(), paid_by_member_id: t.paid_by_member_id ?? ctx.me?.id }).select().single()); },
      async update(id, patch) { return must(await sb().from('transactions').update(patch).eq('id', id).select().single()); },
      async remove(id) { must(await sb().from('transactions').delete().eq('id', id)); },
    },
    budgets: {
      async list(period) { return must(await sb().from('budgets').select('*').eq('household_id', hid()).eq('period', period)); },
      // Kategorisiz (toplam) bütçede PostgREST upsert'i NULL çakışmasını yakalamaz ve
      // mükerrer satır oluşurdu; tekillik ve yetki DB'deki budget_set içinde çözülür.
      async set(b) { return must(await sb().rpc('budget_set', { hid: hid(), p_period: b.period, p_category_id: b.category_id ?? null, p_amount: b.amount_base })); },
      async remove(period, categoryId) {
        let q = sb().from('budgets').delete().eq('household_id', hid()).eq('period', period);
        q = categoryId ? q.eq('category_id', categoryId) : q.is('category_id', null);
        must(await q);
      },
    },
    recurring: {
      async list() { return must(await sb().from('recurring_rules').select('*').eq('household_id', hid()).eq('is_active', true).order('next_due_on')); },
      async create(r) { return must(await sb().from('recurring_rules').insert({ ...r, household_id: hid() }).select().single()); },
      async update(id, patch) { return must(await sb().from('recurring_rules').update(patch).eq('id', id).select().single()); },
    },
    plans: {
      async list() { return must(await sb().from('plans').select('*').eq('household_id', hid()).order('starts_on')); },
      async get(id) { return must(await sb().from('plans').select('*').eq('id', id).single()); },
      async items(planId) { return must(await sb().from('plan_items').select('*').eq('plan_id', planId).order('sort_order')); },
      async create(p) { return must(await sb().from('plans').insert({ ...p, household_id: hid() }).select().single()); },
      async update(id, patch) { return must(await sb().from('plans').update(patch).eq('id', id).select().single()); },
      async addItem(i) { return must(await sb().from('plan_items').insert({ ...i, household_id: hid() }).select().single()); },
      async updateItem(id, patch) { return must(await sb().from('plan_items').update(patch).eq('id', id).select().single()); },
      async contributions(planId) { return must(await sb().from('goal_contributions').select('*').eq('plan_id', planId)); },
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
      async addItem(i) { return must(await sb().from('shopping_items').insert({ ...i, household_id: hid(), added_by_member_id: ctx.me?.id }).select().single()); },
      async toggleItem(id) {
        const cur = must(await sb().from('shopping_items').select('is_checked').eq('id', id).single());
        return must(await sb().from('shopping_items').update({ is_checked: !cur.is_checked }).eq('id', id).select().single());
      },
      async clearChecked(listId) { must(await sb().from('shopping_items').delete().eq('list_id', listId).eq('is_checked', true)); },
    },
    notifications: {
      async list() { return must(await sb().from('notifications').select('*').eq('household_id', hid()).is('read_at', null).order('fire_at', { ascending: false })); },
      async markRead(id) { must(await sb().from('notifications').update({ read_at: new Date().toISOString() }).eq('id', id)); },
    },
    summary: {
      /** Bugün ekranının tamamı tek çağrıda (0004_bootstrap.sql). */
      async today(from, days, period) {
        const s = must(await sb().rpc('today_snapshot', { hid: hid(), p_from: from, p_days: days, p_period: period }));
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
      async signOut() { await sb().auth.signOut(); ctx = { household: null, members: [], me: null }; },
      async createHousehold({ name, base_currency, timezone, display_name, locale }) {
        return must(await sb().rpc('create_household', { p_name: name, p_base_currency: base_currency, p_timezone: timezone, p_display_name: display_name, p_locale: locale || 'tr' }));
      },
      async joinHousehold(code, display_name) { return must(await sb().rpc('join_household', { p_code: code, p_display_name: display_name })); },
    },
    reset() { todo('reset'); },
  };
}
