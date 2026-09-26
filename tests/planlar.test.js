// tests/planlar.test.js — plan kategorileri (0025).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PLAN_GROUPS, PLAN_CATEGORIES, planCategory, categoryList, planSection } from '../lib/planCatalog.js';

test('her kategorinin iki dilde adı, emojisi, grubu ve davranışı var', () => {
  const kinds = ['trip', 'gathering', 'project', 'goal'];
  const groups = new Set(PLAN_GROUPS.map((g) => g.key));
  const eksik = PLAN_CATEGORIES.filter((c) => !c.tr || !c.es || !c.emoji || !groups.has(c.group) || !kinds.includes(c.kind));
  assert.deepEqual(eksik.map((c) => c.key), []);
});

test('hazır listeler iki dilde', () => {
  const eksik = PLAN_CATEGORIES.flatMap((c) => c.list.filter((x) => !x[0] || !x[1]).map(() => c.key));
  assert.deepEqual(eksik, []);
  assert.equal(categoryList(planCategory('visit'), 'es-CL')[0], 'Llevar un regalo o postre');
});

test('MİSAFİRLİĞE GİTMEK VAR ve varsayılan olarak parası yok', () => {
  // Kullanıcının örneği: "arkadaşlar evine davet etti, bunu planlayamıyorum."
  const c = planCategory('visit');
  assert.equal(c.money, false);
  assert.equal(c.guests, false);   // misafir listesi ağırlarken anlamlı, giderken değil
});

test('eski planlar (kategorisiz) türünden tahmin edilir', () => {
  assert.equal(planCategory({ kind: 'trip' }).key, 'trip');
  assert.equal(planCategory({ kind: 'gathering' }).key, 'host');
  assert.equal(planCategory({ kind: 'goal' }).key, 'goal');
  assert.equal(planCategory({}).key, 'other');
});

test('bölümler: yaklaşan, fikir, hedef, geçmiş', () => {
  const T = '2026-09-26';
  assert.equal(planSection({ kind: 'gathering', status: 'planned', starts_on: '2026-09-27' }, T), 'upcoming');
  assert.equal(planSection({ kind: 'trip', status: 'active', starts_on: '2026-09-20', ends_on: '2026-09-30' }, T), 'upcoming');
  assert.equal(planSection({ kind: 'project', status: 'idea', starts_on: null }, T), 'ideas');
  assert.equal(planSection({ kind: 'goal', status: 'active', starts_on: '2026-01-01' }, T), 'goals');
  assert.equal(planSection({ kind: 'gathering', status: 'planned', starts_on: '2026-09-01' }, T), 'past');
  assert.equal(planSection({ kind: 'gathering', status: 'cancelled', starts_on: '2026-10-01' }, T), 'past');
});

// ---- Plan masrafları (0028) — demo deposu SQL tetiklerinin aynası ----------
import makeDemoRepo from '../lib/data/demoRepo.js';

async function yeniPlan() {
  const repo = makeDemoRepo(); repo.reset('tr');
  const plan = await repo.plans.create({ title: 'Padel', kind: 'gathering', category: 'sport', has_money: false });
  const harcamalar = async () => (await repo.transactions.list({ planId: plan.id }));
  return { repo, plan, harcamalar };
}

test('masraf: ödendi eklenince Bütçe’ye harcama düşer (aile harcaması, plana bağlı)', async () => {
  const { repo, plan, harcamalar } = await yeniPlan();
  await repo.plans.addItem({ plan_id: plan.id, kind: 'checklist', title: 'Kort ücreti', amount: 10000, currency: 'CLP', is_done: true });
  const h = await harcamalar();
  assert.equal(h.length, 1);
  assert.equal(h[0].amount, 10000);
  assert.equal(h[0].for_member_id, null);
  assert.equal(h[0].merchant, 'Kort ücreti');
});

test('masraf: ödenmemiş bekler; işaretlenince düşer, işaret kalkınca kalkar', async () => {
  const { repo, plan, harcamalar } = await yeniPlan();
  const k = await repo.plans.addItem({ plan_id: plan.id, kind: 'checklist', title: 'Pasta', amount: 15000, currency: 'CLP', is_done: false });
  assert.equal((await harcamalar()).length, 0);
  await repo.plans.updateItem(k.id, { is_done: true });
  assert.equal((await harcamalar()).length, 1);
  await repo.plans.updateItem(k.id, { amount: 18000 });
  assert.equal((await harcamalar())[0].amount, 18000);
  await repo.plans.updateItem(k.id, { is_done: false });
  assert.equal((await harcamalar()).length, 0);
});

test('masraf: kalem silinince harcaması da silinir; harcama silinince kalem ödenmediye döner', async () => {
  const { repo, plan, harcamalar } = await yeniPlan();
  const a = await repo.plans.addItem({ plan_id: plan.id, kind: 'checklist', title: 'A', amount: 1000, currency: 'CLP', is_done: true });
  const b = await repo.plans.addItem({ plan_id: plan.id, kind: 'checklist', title: 'B', amount: 2000, currency: 'CLP', is_done: true });
  await repo.plans.removeItem(a.id);
  assert.deepEqual((await harcamalar()).map((x) => x.merchant), ['B']);
  await repo.transactions.remove((await harcamalar())[0].id);
  const kalem = (await repo.plans.items(plan.id)).find((i) => i.id === b.id);
  assert.equal(kalem.is_done, false);
});

test('plan silinebiliyor; ödenmiş masraflar Bütçe’de kalır', async () => {
  const { repo, plan } = await yeniPlan();
  await repo.plans.addItem({ plan_id: plan.id, kind: 'checklist', title: 'Kort', amount: 10000, currency: 'CLP', is_done: true });
  await repo.plans.remove(plan.id);
  assert.equal((await repo.plans.list()).some((p) => p.id === plan.id), false);
  const hepsi = await repo.transactions.list({});
  assert.equal(hepsi.some((t) => t.merchant === 'Kort' && t.amount === 10000), true);
});

// ---- Hediye planı (0032) ---------------------------------------------------
import { hediyeUygun, hediyeLinki, hediyePlani, HEDIYE_LISTESI } from '../lib/planCatalog.js';

test('hediye: doğum günü ve yıldönümü uygun, anma ve özel gün değil', () => {
  assert.equal(hediyeUygun({ kind: 'birthday' }), true);
  assert.equal(hediyeUygun({ kind: 'anniversary' }), true);
  assert.equal(hediyeUygun({ kind: 'memorial' }), false);
  assert.equal(hediyeUygun({ kind: 'custom' }), false);
});

test('hediye: bağlantı ve o yılın planı eşleşmesi', () => {
  const o = { id: 'o1', kind: 'birthday', date: '2026-10-09' };
  assert.equal(hediyeLinki(o), '/planlar/?hediye=o1&d=2026-10-09');
  assert.equal(hediyePlani([{ occasion_id: 'o1', starts_on: '2025-10-09' }], o), null, 'geçen yılın planı sayılmaz');
  assert.ok(hediyePlani([{ occasion_id: 'o1', starts_on: '2026-10-09' }], o));
  assert.ok(HEDIYE_LISTESI.every(([tr, es]) => tr && es));
});

test('hediye planı demo deposunda önemli güne bağlı kaydediliyor', async () => {
  const repo = makeDemoRepo(); repo.reset('tr');
  const [o] = await repo.occasions.list();
  const p = await repo.plans.create({ title: 'x', kind: 'gathering', category: 'celebration', starts_on: o.date, occasion_id: o.id });
  assert.ok(hediyePlani(await repo.plans.list(), o));
  assert.equal(p.occasion_id, o.id);
});
