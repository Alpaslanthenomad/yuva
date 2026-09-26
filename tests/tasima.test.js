// tests/tasima.test.js — 0029: limit taşıma, eşin kişisel harcamasının
// maskelenmesi ve plan masrafının yerinde düzeltilmesi (demo deposu, SQL'in aynası).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import makeDemoRepo from '../lib/data/demoRepo.js';
import { today, periodOf } from '../lib/dates.js';

function depo() { const r = makeDemoRepo(); r.reset('tr'); return r; }
const P = periodOf(today());
const sonraki = (p, n = 1) => {
  const [y, m] = p.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return d.toISOString().slice(0, 7);
};
const toplamLimit = async (repo, p) => (await repo.summary.budgetStatus(p)).find((b) => b.category_id === null);

test('limit sonraki aylara kendiliğinden taşınır, önceki aylara taşınmaz', async () => {
  const repo = depo();
  await repo.budgets.set({ period: P, category_id: null, amount_base: 900000 });
  const gelecek = await toplamLimit(repo, sonraki(P, 3));
  assert.equal(gelecek.budget, 900000);
  assert.equal(gelecek.from_period, P);
  assert.equal(await toplamLimit(repo, sonraki(P, -1)), undefined);
});

test('bir ayda değiştirilen limit o aydan itibaren geçerli; ileri ayarlar silinir', async () => {
  const repo = depo();
  await repo.budgets.set({ period: P, category_id: null, amount_base: 900000 });
  await repo.budgets.set({ period: sonraki(P, 2), category_id: null, amount_base: 700000 });
  assert.equal((await toplamLimit(repo, sonraki(P, 1))).budget, 900000);
  assert.equal((await toplamLimit(repo, sonraki(P, 5))).budget, 700000);
  await repo.budgets.set({ period: P, category_id: null, amount_base: 800000 });
  assert.equal((await toplamLimit(repo, sonraki(P, 5))).budget, 800000, 'bu aydan yapılan ayar ilerisini ezer');
});

test('limit kaldırılınca bu aydan itibaren gider, geçmiş ay kalır', async () => {
  const repo = depo();
  await repo.budgets.set({ period: P, category_id: null, amount_base: 900000 });
  await repo.budgets.remove(sonraki(P, 1), null);
  assert.equal((await toplamLimit(repo, P)).budget, 900000);
  assert.equal(await toplamLimit(repo, sonraki(P, 1)), undefined);
  assert.equal(await toplamLimit(repo, sonraki(P, 4)), undefined);
});

test('eşin kişisel harcaması listede maskeli: tutar var, nereye/kategori yok', async () => {
  const repo = depo();
  const liste = await repo.transactions.list({ period: P });
  const gizli = liste.filter((x) => x.masked);
  assert.ok(gizli.length >= 1);
  for (const x of gizli) {
    assert.equal(x.merchant, undefined);
    assert.equal(x.category_id, undefined);
    assert.equal(x.note, undefined);
    assert.ok(Number(x.amount) > 0);
  }
  assert.ok(liste.some((x) => x.for_member_id === 'm_baba' && !x.masked && x.merchant));
});

test('masraf yerinde düzeltilince bağlı harcama da güncellenir', async () => {
  const repo = depo();
  const plan = await repo.plans.create({ title: 'Mark', kind: 'gathering', category: 'visit' });
  const k = await repo.plans.addItem({ plan_id: plan.id, kind: 'checklist', title: 'Pasta', amount: 15000, currency: 'CLP', is_done: true });
  await repo.plans.updateItem(k.id, { title: 'Tart', amount: 18000 });
  const h = await repo.transactions.list({ planId: plan.id });
  assert.equal(h.length, 1);
  assert.equal(Number(h[0].amount), 18000);
  assert.equal(h[0].merchant, 'Tart');
});
