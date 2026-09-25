// lib/data/demoRepo.js — localStorage üstünde sahte backend. RPC mantığını (özet, bütçe, ajanda) taklit eder.
import { buildDemo } from './demoSeed.js';
import { expandRRule, today, addDays, addMonths, periodOf, nextOccasionDate, daysBetween, fromISODate } from '../dates.js';
import { detectLocale } from '../i18n/index.js';

const KEY = 'yuva:demo:v2';
const uid = (p) => p + '_' + Math.random().toString(36).slice(2, 9);
const isBrowser = () => typeof window !== 'undefined';

let cache = null;
// Başka bir sekme depoyu değiştirdiyse bellekteki kopya eskir. Gerçek kipte
// bunu Realtime hallediyor (0009); demo kipinde iki sekme birbirini hiç
// görmüyordu. Olay yalnızca DİĞER sekmelerin yazmasında tetiklenir.
if (isBrowser()) window.addEventListener('storage', (e) => { if (e.key === KEY) cache = null; });

function load() {
  if (cache) return cache;
  if (isBrowser()) {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) { cache = JSON.parse(raw); return cache; }
    } catch { /* yoksay */ }
  }
  cache = buildDemo(detectLocale());
  save();
  return cache;
}
function save() {
  if (!isBrowser() || !cache) return;
  try { localStorage.setItem(KEY, JSON.stringify(cache)); } catch { /* kota */ }
}
function toBase(db, amount, ccy) {
  const b = db.household.base_currency;
  if (ccy === b) return Number(amount);
  const r = db.rates;
  const usdOf = (c) => c === 'USD' ? 1 : 1 / r['USD' + c];
  return Number(amount) * usdOf(ccy) * (b === 'USD' ? 1 : r['USD' + b]);
}
const delay = (v) => new Promise((res) => setTimeout(() => res(v), 30));

function rollupCategory(db, catId) {
  const c = db.categories.find((x) => x.id === catId);
  return c?.parent_id ? db.categories.find((x) => x.id === c.parent_id) : c;
}

export function createDemoRepo() {
  return {
    mode: 'demo',
    async init() { const db = load(); return delay({ household: db.household, members: db.members, me: db.me }); },

    backup: {
      // Geri yükleme demo kipinde yok: gerçek kipte yedek YENİ bir hane olarak
      // açılıyor (0018), demo deposunda ise tek hane var — aynı davranışı
      // taklit edemez. Ayarlar ekranı düğmeyi yalnızca bağlı kipte gösteriyor.
      async importAll() { throw new Error('demo'); },
      async exportAll() {
        const db = load();
        return delay({
          format: 'yuva-backup-1', exported_at: new Date().toISOString(),
          household: db.household, members: db.members, accounts: db.accounts,
          categories: db.categories, recurring_rules: db.recurring, plans: db.plans,
          plan_items: db.plan_items, calendar_events: db.calendar_events,
          event_attendees: [], transactions: db.transactions, budgets: db.budgets,
          goal_contributions: db.goal_contributions, occasions: db.occasions,
          documents: db.documents, contacts: [], tasks: db.tasks,
          task_completions: db.task_completions || [],
          shopping_lists: db.shopping_lists, shopping_items: db.shopping_items,
        });
      },
    },
    // Demo modda tek cihaz var; abonelik boş geçer ama sözleşme korunur.
    subscribe(onChange, onStatus) { onStatus?.('SUBSCRIBED'); return () => {}; },
    household: {
      async get() { return delay(load().household); },
      async update(patch) { const db = load(); Object.assign(db.household, patch); save(); return delay(db.household); },
      async rotateJoinCode({ role = 'adult', hours = 168, uses = 1 } = {}) {
        const db = load();
        const code = Array.from({ length: 8 }, () => '0123456789ABCDEF'[Math.floor(Math.random() * 16)]).join('');
        Object.assign(db.household, {
          join_code: code, join_code_role: role, join_code_uses_left: uses,
          join_code_expires_at: new Date(Date.now() + hours * 3600e3).toISOString(),
        });
        save(); return delay(code);
      },
      // Demo kipinde tek hane var; sözleşme aynı kalsın diye yine de tanımlı.
      async list() { const db = load(); return delay([{ id: db.household.id, name: db.household.name, base_currency: db.household.base_currency, is_default: true, members: db.members.length }]); },
      async setDefault() { return delay(undefined); },
    },
    members: {
      async list() { return delay(load().members.filter((m) => m.is_active)); },
      async create(m) { const db = load(); const row = { id: uid('m'), household_id: db.household.id, role: 'adult', color: '#4F7CAC', avatar_emoji: '🙂', is_active: true, ...m }; db.members.push(row); save(); return delay(row); },
      async update(id, patch) { const db = load(); const r = db.members.find((x) => x.id === id); Object.assign(r, patch); save(); return delay(r); },
    },
    events: {
      /** from..to aralığındaki oluşumlar (tekrarlar açılır). Her oluşum: {...event, date} */
      async list({ from, to }) {
        const db = load();
        const out = [];
        for (const e of db.calendar_events) {
          const startIso = e.starts_at.slice(0, 10);
          const localStart = new Date(e.starts_at); const s0 = `${localStart.getFullYear()}-${String(localStart.getMonth() + 1).padStart(2, '0')}-${String(localStart.getDate()).padStart(2, '0')}`;
          if (e.all_day && !e.rrule) {
            const endIso = (e.ends_at || e.starts_at).slice(0, 10);
            let d = s0 < from ? from : s0;
            while (d <= to && d <= endIso) { out.push({ ...e, date: d }); d = addDays(d, 1); }
            continue;
          }
          const dates = expandRRule(e.rrule, s0, from, to, e.exdates);
          for (const d of dates) out.push({ ...e, date: d, _origStart: startIso });
        }
        out.sort((a, b) => (a.date + a.starts_at.slice(11)).localeCompare(b.date + b.starts_at.slice(11)));
        return delay(out);
      },
      async create(e) { const db = load(); const row = { id: uid('e'), household_id: db.household.id, category: 'other', all_day: false, attendees: [], ...e }; db.calendar_events.push(row); save(); return delay(row); },
      async update(id, patch) { const db = load(); const r = db.calendar_events.find((x) => x.id === id); Object.assign(r, patch); save(); return delay(r); },
      async remove(id) { const db = load(); db.calendar_events = db.calendar_events.filter((x) => x.id !== id); save(); return delay(); },
      async skipOccurrence(id, date) {
        const db = load(); const r = db.calendar_events.find((x) => x.id === id);
        if (!r || !r.rrule) return delay(r);
        r.exdates = Array.from(new Set([...(r.exdates || []), date]));
        save(); return delay(r);
      },
    },
    accounts: {
      async list() { return delay(load().accounts.filter((a) => !a.is_archived)); },
      async balances() {
        const db = load();
        return delay(db.accounts.filter((a) => !a.is_archived).map((a) => {
          let bal = Number(a.opening_balance);
          for (const t of db.transactions) {
            if (t.account_id === a.id) bal += t.kind === 'income' ? Number(t.amount) : -Number(t.amount);
            else if (t.kind === 'transfer' && t.transfer_account_id === a.id) bal += Number(t.transfer_amount ?? t.amount);
          }
          return { ...a, account_id: a.id, balance: bal, balance_base: toBase(db, bal, a.currency) };
        }));
      },
      async create(a) { const db = load(); const row = { id: uid('a'), household_id: db.household.id, type: 'bank', opening_balance: 0, icon: '🏦', is_archived: false, ...a }; db.accounts.push(row); save(); return delay(row); },
    },
    categories: { async list() { return delay(load().categories); } },
    transactions: {
      async list({ period, limit, planId } = {}) {
        const db = load();
        let rows = db.transactions;
        if (period) rows = rows.filter((t) => periodOf(t.occurred_on) === period);
        if (planId) rows = rows.filter((t) => t.plan_id === planId);
        rows = [...rows].sort((a, b) => b.occurred_on.localeCompare(a.occurred_on));
        if (limit) rows = rows.slice(0, limit);
        return delay(rows);
      },
      async create(t) {
        const db = load();
        const row = { id: uid('t'), household_id: db.household.id, kind: 'expense', occurred_on: today(), tags: [], ...t };
        row.fx_rate = toBase(db, 1, row.currency);
        row.amount_base = Math.round(toBase(db, row.amount, row.currency) * 100) / 100;
        db.transactions.push(row); save(); return delay(row);
      },
      async update(id, patch) {
        const db = load(); const r = db.transactions.find((x) => x.id === id); Object.assign(r, patch);
        r.fx_rate = toBase(db, 1, r.currency); r.amount_base = Math.round(toBase(db, r.amount, r.currency) * 100) / 100;
        save(); return delay(r);
      },
      async remove(id) { const db = load(); db.transactions = db.transactions.filter((x) => x.id !== id); save(); return delay(); },
    },
    budgets: {
      async list(period) { return delay(load().budgets.filter((b) => b.period === period)); },
      async set(b) {
        const db = load();
        const ex = db.budgets.find((x) => x.period === b.period && x.category_id === b.category_id);
        if (ex) { Object.assign(ex, b); save(); return delay(ex); }
        const row = { id: uid('b'), household_id: db.household.id, rollover: false, ...b }; db.budgets.push(row); save(); return delay(row);
      },
      async remove(period, categoryId) {
        const db = load();
        db.budgets = db.budgets.filter((b) => !(b.period === period && (b.category_id || null) === (categoryId || null)));
        save(); return delay();
      },
    },
    recurring: {
      async list() { return delay([...load().recurring].sort((a, b) => a.next_due_on.localeCompare(b.next_due_on))); },
      async create(r) { const db = load(); const row = { id: uid('r'), household_id: db.household.id, kind: 'expense', rrule: 'FREQ=MONTHLY', reminder_days: 3, auto_post: false, is_active: true, ...r }; db.recurring.push(row); save(); return delay(row); },
      async update(id, patch) { const db = load(); const r = db.recurring.find((x) => x.id === id); Object.assign(r, patch); save(); return delay(r); },
    },
    plans: {
      async list() { return delay(load().plans); },
      async get(id) { return delay(load().plans.find((p) => p.id === id)); },
      async items(planId) { return delay(load().plan_items.filter((i) => i.plan_id === planId)); },
      async create(p) { const db = load(); const row = { id: uid('p'), household_id: db.household.id, kind: 'trip', status: 'planned', icon: '✈️', ...p }; db.plans.push(row); save(); return delay(row); },
      async update(id, patch) { const db = load(); const r = db.plans.find((x) => x.id === id); Object.assign(r, patch); save(); return delay(r); },
      async addItem(i) { const db = load(); const row = { id: uid('pi'), household_id: db.household.id, kind: 'checklist', is_done: false, ...i }; db.plan_items.push(row); save(); return delay(row); },
      async updateItem(id, patch) { const db = load(); const r = db.plan_items.find((x) => x.id === id); Object.assign(r, patch); save(); return delay(r); },
      async contributions(planId) {
        return delay(load().goal_contributions.filter((g) => g.plan_id === planId)
          .sort((a, b) => (b.on_date || '').localeCompare(a.on_date || '')));
      },
      // Supabase'te kuru tetikleyici donduruyor (0006); demo da aynısını yapmalı,
      // yoksa hedef ilerlemesi iki kipte farklı çıkar.
      async addContribution(c) {
        const db = load();
        const row = { id: uid('gc'), household_id: db.household.id, on_date: today(), ...c };
        row.fx_rate = toBase(db, 1, row.currency);
        row.amount_base = Math.round(toBase(db, row.amount, row.currency) * 100) / 100;
        db.goal_contributions.push(row); save(); return delay(row);
      },
    },
    occasions: {
      async list() {
        const db = load();
        return delay(db.occasions.map((o) => ({ ...o, ...nextOccasionDate(o.month, o.day) })).sort((a, b) => a.daysLeft - b.daysLeft));
      },
      async create(o) { const db = load(); const row = { id: uid('o'), household_id: db.household.id, kind: 'custom', remind_days: 7, ...o }; db.occasions.push(row); save(); return delay(row); },
    },
    documents: {
      async list() {
        const T = today();
        return delay([...load().documents].map((d) => ({ ...d, daysLeft: d.expires_on ? daysBetween(T, d.expires_on) : null })).sort((a, b) => (a.daysLeft ?? 9e9) - (b.daysLeft ?? 9e9)));
      },
      async create(d) { const db = load(); const row = { id: uid('d'), household_id: db.household.id, kind: 'other', remind_days: 30, ...d }; db.documents.push(row); save(); return delay(row); },
    },
    tasks: {
      async list() { return delay([...load().tasks].sort((a, b) => (a.is_done - b.is_done) || (a.due_on || '9').localeCompare(b.due_on || '9'))); },
      async create(t) { const db = load(); const row = { id: uid('k'), household_id: db.household.id, points: 0, is_done: false, ...t }; db.tasks.push(row); save(); return delay(row); },
      async update(id, patch) { const db = load(); const r = db.tasks.find((x) => x.id === id); Object.assign(r, patch); save(); return delay(r); },
      async complete(id, nextDue = null) {
        const db = load(); const r = db.tasks.find((x) => x.id === id);
        db.task_completions = db.task_completions || [];
        // prev_due_on: geri alınca vade eski gününe dönsün (0014 ile aynı davranış).
        db.task_completions.push({ id: uid('tc'), household_id: db.household.id, task_id: id,
          member_id: r.assignee_member_id || db.me?.id, done_on: today(), points: r.points || 0,
          prev_due_on: r.due_on || null });
        if (nextDue) { r.due_on = nextDue; r.is_done = false; r.done_at = null; }
        else { r.is_done = true; r.done_at = new Date().toISOString(); }
        save(); return delay(r);
      },
      async uncomplete(id) {
        const db = load(); const r = db.tasks.find((x) => x.id === id);
        const mine = (db.task_completions || []).filter((c) => c.task_id === id);
        const last = mine[mine.length - 1];
        if (last) db.task_completions = db.task_completions.filter((c) => c !== last);
        // Tekrarlayan görevde tamamlama vadeyi ileri taşımıştı; geri al onu da geri alır.
        if (last && last.prev_due_on) r.due_on = last.prev_due_on;
        r.is_done = false; r.done_at = null; save(); return delay(r);
      },
      async postpone(id, days = 1) {
        const db = load(); const r = db.tasks.find((x) => x.id === id);
        r.due_on = addDays(r.due_on || today(), days); r.is_done = false; r.done_at = null;
        save(); return delay(r);
      },
      async skip(id, nextDue) {
        const db = load(); const r = db.tasks.find((x) => x.id === id);
        r.due_on = nextDue; r.is_done = false; r.done_at = null; save(); return delay(r);
      },
      async completions(from) {
        const db = load();
        return delay((db.task_completions || []).filter((c) => !from || c.done_on >= from));
      },
    },
    shopping: {
      async lists() { return delay(load().shopping_lists.filter((l) => !l.is_archived)); },
      async items(listId) { const db = load(); return delay(db.shopping_items.filter((i) => !listId || i.list_id === listId)); },
      // Favori sayacı gerçek kipte DB'de artıyor (0019); demo da aynı davranmalı,
      // yoksa "sık alınanlar" iki kipte farklı çıkar. catalog_key satıra YAZILMAZ,
      // yalnızca sayacı besler — alışveriş kaleminin böyle bir sütunu yok.
      async addItem(i) {
        const db = load();
        const { catalog_key, ...rest } = i;
        const row = { id: uid('si'), household_id: db.household.id, list_id: db.shopping_lists[0].id, is_checked: false, added_by_member_id: db.me?.id, ...rest };
        db.shopping_items.push(row);
        if (catalog_key) {
          db.shopping_favorites = db.shopping_favorites || {};
          const f = db.shopping_favorites[catalog_key] || { uses: 0, at: 0 };
          db.shopping_favorites[catalog_key] = { uses: f.uses + 1, at: Date.now() };
        }
        save(); return delay(row);
      },
      async favorites(limit = 12) {
        const f = load().shopping_favorites || {};
        return delay(Object.entries(f)
          .sort((a, b) => (b[1].uses - a[1].uses) || (b[1].at - a[1].at))
          .slice(0, limit)
          .map(([catalog_key, v]) => ({ catalog_key, uses: v.uses })));
      },
      async checkout(listId, txn) {
        const db = load();
        const row = { id: uid('t'), household_id: db.household.id, kind: 'expense', occurred_on: today(), tags: [], ...txn,
          paid_by_member_id: db.me?.id };
        // Supabase'deki trigger ne yapıyorsa burada da aynısı: kur işlem anında dondurulur.
        row.fx_rate = toBase(db, 1, row.currency);
        row.amount_base = Math.round(toBase(db, row.amount, row.currency) * 100) / 100;
        db.transactions.push(row);
        db.shopping_items = db.shopping_items.filter((x) => !(x.list_id === listId && x.is_checked));
        save(); return delay(row);
      },
      async toggleItem(id) { const db = load(); const r = db.shopping_items.find((x) => x.id === id); r.is_checked = !r.is_checked; save(); return delay(r); },
      async clearChecked(listId) { const db = load(); db.shopping_items = db.shopping_items.filter((i) => !(i.list_id === listId && i.is_checked)); save(); return delay(); },
      async removeItem(id) { const db = load(); db.shopping_items = db.shopping_items.filter((x) => x.id !== id); save(); return delay(undefined); },
    },
    notifications: {
      async list({ all = false, limit = 50 } = {}) {
        const rows = load().notifications.filter((n) => all || !n.read_at);
        return delay(rows.slice(0, limit));
      },
      async markRead(id) { const db = load(); const n = db.notifications.find((x) => x.id === id); if (n) n.read_at = new Date().toISOString(); save(); return delay(); },
      async markAllRead() { const db = load(); const now = new Date().toISOString(); db.notifications.forEach((n) => { if (!n.read_at) n.read_at = now; }); save(); return delay(); },
    },
    summary: {
      /** today_snapshot RPC taklidi — Bugün ekranı tek çağrıda alsın diye. */
      async today(from, days, period) {
        const db = load();
        const [agenda, month, budget] = await Promise.all([
          this.agenda(from, days), this.month(period), this.budgetStatus(period),
        ]);
        return {
          agenda, month, budget,
          shopping: db.shopping_items,
          notifs: db.notifications.filter((n) => !n.read_at),
        };
      },
      /** month_summary RPC taklidi */
      async month(period) {
        const db = load();
        const rows = db.transactions.filter((t) => periodOf(t.occurred_on) === period);
        const expense = rows.filter((t) => t.kind === 'expense').reduce((s, t) => s + t.amount_base, 0);
        const income = rows.filter((t) => t.kind === 'income').reduce((s, t) => s + t.amount_base, 0);
        const byCat = {}; const byMem = {}; let fixed = 0;
        for (const t of rows.filter((x) => x.kind === 'expense')) {
          const c = rollupCategory(db, t.category_id);
          const key = c?.id || 'none';
          byCat[key] ||= { category_id: key, name: c?.name || 'Kategorisiz', icon: c?.icon || '🏷️', total: 0 };
          byCat[key].total += t.amount_base;
          const leaf = db.categories.find((x) => x.id === t.category_id);
          if (leaf?.is_fixed || c?.is_fixed) fixed += t.amount_base;
          const mk = t.for_member_id || 'shared';
          byMem[mk] ||= { member_id: mk, name: db.members.find((m) => m.id === mk)?.display_name || 'Ortak', total: 0 };
          byMem[mk].total += t.amount_base;
        }
        return delay({
          period, expense, income, fixed, variable: expense - fixed,
          by_category: Object.values(byCat).sort((a, b) => b.total - a.total),
          by_member: Object.values(byMem).sort((a, b) => b.total - a.total),
        });
      },
      async budgetStatus(period) {
        const db = load();
        const m = await this.month(period);
        return db.budgets.filter((b) => b.period === period).map((b) => {
          const spent = b.category_id ? (m.by_category.find((c) => c.category_id === b.category_id)?.total || 0) : m.expense;
          const c = db.categories.find((x) => x.id === b.category_id);
          return { category_id: b.category_id, category_name: c?.name || 'Toplam', icon: c?.icon || '🎯', budget: b.amount_base, spent, remaining: b.amount_base - spent, pct: b.amount_base ? Math.round((spent / b.amount_base) * 1000) / 10 : 0 };
        }).sort((a, b) => (a.category_id === null) - (b.category_id === null) || b.pct - a.pct);
      },
      /**
       * month_trend RPC taklidi (0020). Pencere `period` ayında biter.
       * Hareketsiz ay da satır üretir — grafiğin boş ayı atlayıp iki dolu ayı
       * yan yana getirmesi, olmayan bir artış gösterir.
       */
      async trend(period, months = 6) {
        const db = load();
        const n = Math.min(Math.max(months || 6, 1), 24);
        const donemler = [];
        for (let i = n - 1; i >= 0; i -= 1) donemler.push(periodOf(addMonths(period + '-01', -i)));
        const icinde = (t) => donemler.includes(periodOf(t.occurred_on));
        const rows = db.transactions.filter(icinde);

        const aylik = donemler.map((p) => {
          const ay = rows.filter((t) => periodOf(t.occurred_on) === p);
          const gider = ay.filter((t) => t.kind === 'expense');
          const expense = gider.reduce((s, t) => s + t.amount_base, 0);
          const income = ay.filter((t) => t.kind === 'income').reduce((s, t) => s + t.amount_base, 0);
          const fixed = gider.reduce((s, t) => {
            const leaf = db.categories.find((x) => x.id === t.category_id);
            const up = rollupCategory(db, t.category_id);
            return s + (leaf?.is_fixed || up?.is_fixed ? t.amount_base : 0);
          }, 0);
          return { period: p, income, expense, fixed, variable: expense - fixed, net: income - expense };
        });

        const byCat = {};
        for (const t of rows.filter((x) => x.kind === 'expense')) {
          const c = rollupCategory(db, t.category_id);
          if (!c) continue;
          byCat[c.id] ||= { category_id: c.id, name: c.name, icon: c.icon || '🏷️', total: 0, by_month: Object.fromEntries(donemler.map((p) => [p, 0])) };
          byCat[c.id].total += t.amount_base;
          byCat[c.id].by_month[periodOf(t.occurred_on)] += t.amount_base;
        }

        return delay({
          from: donemler[0], to: period, months: aylik,
          categories: Object.values(byCat).sort((a, b) => b.total - a.total).slice(0, 8),
        });
      },
      async agenda(from, days) {
        const db = load(); const to = addDays(from, days);
        const events = await this._events({ from, to });
        return delay({
          events,
          occasions: db.occasions.map((o) => ({ ...o, ...nextOccasionDate(o.month, o.day, from) })).filter((o) => o.daysLeft <= days).sort((a, b) => a.daysLeft - b.daysLeft),
          bills: db.recurring.filter((r) => r.is_active && r.next_due_on >= from && r.next_due_on <= to).sort((a, b) => a.next_due_on.localeCompare(b.next_due_on)),
          documents: db.documents.filter((d) => d.expires_on && daysBetween(from, d.expires_on) <= d.remind_days).map((d) => ({ ...d, daysLeft: daysBetween(from, d.expires_on) })).sort((a, b) => a.daysLeft - b.daysLeft),
          tasks: db.tasks.filter((t) => !t.is_done && (!t.due_on || t.due_on <= to)),
        });
      },
    },
    /** KİŞİSEL (0021) — demo kipinde tek kullanıcı var, sahiplik hep bizde. */
    personal: {
      _db() {
        const db = load();
        db.day_blocks ||= []; db.day_block_logs ||= []; db.goals ||= []; db.goal_logs ||= [];
        return db;
      },
      _scope(d) { const g = fromISODate(d).getDay(); return (g === 0 || g === 6) ? 'weekend' : 'weekday'; },
      async day(date) {
        const db = this._db(); const d = date || today();
        const scope = this._scope(d);
        const blocks = db.day_blocks.filter((b) => b.scope === scope)
          .sort((a, b) => a.starts_at.localeCompare(b.starts_at))
          .map((b) => ({ ...b, done: db.day_block_logs.some((l) => l.block_id === b.id && l.on_date === d) }));
        // Son 7 gün: bloğu olmayan gün paydaya girmez (SQL ile aynı kural).
        let toplam = 0; let yapilan = 0;
        for (let i = 6; i >= 0; i -= 1) {
          const g = addDays(d, -i);
          toplam += db.day_blocks.filter((b) => b.scope === this._scope(g)).length;
          yapilan += db.day_block_logs.filter((l) => l.on_date === g).length;
        }
        return delay({ date: d, scope, blocks, adherence7: toplam ? Math.round((100 * yapilan) / toplam) : null });
      },
      async goals(date) {
        const db = this._db(); const d = date || today();
        const hb = addDays(d, -((fromISODate(d).getDay() + 6) % 7));
        return delay(db.goals.filter((g) => g.is_active !== false).map((g) => {
          const bugun = db.goal_logs.find((l) => l.goal_id === g.id && l.on_date === d)?.amount || 0;
          let ilerleme = bugun;
          if (g.kind === 'weekly') {
            ilerleme = db.goal_logs.filter((l) => l.goal_id === g.id && l.amount > 0
              && l.on_date >= hb && l.on_date <= addDays(hb, 6)).length;
          } else if (g.kind === 'total') {
            ilerleme = db.goal_logs.filter((l) => l.goal_id === g.id).reduce((s, l) => s + Number(l.amount), 0);
          }
          return { ...g, today: bugun, progress: ilerleme, pct: Math.min(100, Math.round((100 * ilerleme) / g.target)) };
        }));
      },
      async toggleBlock(id, date) {
        const db = this._db(); const d = date || today();
        const i = db.day_block_logs.findIndex((l) => l.block_id === id && l.on_date === d);
        if (i >= 0) { db.day_block_logs.splice(i, 1); save(); return delay(false); }
        db.day_block_logs.push({ block_id: id, on_date: d }); save(); return delay(true);
      },
      async setGoal(id, amount, date) {
        const db = this._db(); const d = date || today();
        const i = db.goal_logs.findIndex((l) => l.goal_id === id && l.on_date === d);
        if (!amount || amount <= 0) { if (i >= 0) db.goal_logs.splice(i, 1); save(); return delay(0); }
        if (i >= 0) db.goal_logs[i].amount = amount; else db.goal_logs.push({ goal_id: id, on_date: d, amount });
        save(); return delay(amount);
      },
      async blocks(scope) {
        return delay(this._db().day_blocks.filter((b) => b.scope === scope)
          .sort((a, b) => a.starts_at.localeCompare(b.starts_at)));
      },
      async addBlock(b) {
        const db = this._db(); const row = { id: uid('blk'), ...b }; db.day_blocks.push(row); save(); return delay(row);
      },
      async removeBlock(id) {
        const db = this._db();
        db.day_blocks = db.day_blocks.filter((b) => b.id !== id);
        db.day_block_logs = db.day_block_logs.filter((l) => l.block_id !== id);
        save(); return delay();
      },
      async addGoal(g) {
        const db = this._db(); const row = { id: uid('goal'), is_active: true, starts_on: today(), ...g };
        db.goals.push(row); save(); return delay(row);
      },
      async removeGoal(id) {
        const db = this._db();
        db.goals = db.goals.filter((g) => g.id !== id);
        db.goal_logs = db.goal_logs.filter((l) => l.goal_id !== id);
        save(); return delay();
      },
    },
    fx: { async rates() { return delay(load().rates); } },
    auth: {
      async signIn() { return delay(); },
      async signUp() { return delay(); },
      async changePassword() { return delay(); },
      async signOut() { return delay(); },
      async createHousehold() { return delay(load().household.id); },
      async joinHousehold() { return delay(load().household.id); },
    },
    /** demo-only: geçerli dilde yeni demo veri üretir */
    reset(locale) { cache = buildDemo(locale || detectLocale()); save(); },
  };
}

// summary.agenda içinden events.list'e erişim için küçük köprü
const _repoProto = createDemoRepo;
export default function makeDemoRepo() {
  const repo = _repoProto();
  repo.summary._events = (q) => repo.events.list(q);
  return repo;
}
