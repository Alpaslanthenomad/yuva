// tests/butce.test.js — aile ve kişisel bütçe ayrımı (0027).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import makeDemoRepo from '../lib/data/demoRepo.js';
import { today, periodOf } from '../lib/dates.js';

function depo() { const r = makeDemoRepo(); r.reset('tr'); return r; }
const P = periodOf(today());

test('kişisel harcama aile özetine girmez, sahibinin kişiselinde görünür', async () => {
  const repo = depo();
  const once = await repo.summary.month(P);
  await repo.transactions.create({ kind: 'expense', amount: 10000, currency: 'CLP', account_id: 'a_kart', occurred_on: today(), merchant: 'Berber', for_member_id: 'm_baba' });
  const sonra = await repo.summary.month(P);
  assert.equal(sonra.expense, once.expense, 'aile toplamı değişmemeli');
  assert.equal(sonra.personal.total, once.personal.total + 10000);
  assert.equal(sonra.total_expense, once.total_expense + 10000);
});

test('aile harcaması aile özetine girer, kişiseli değiştirmez', async () => {
  const repo = depo();
  const once = await repo.summary.month(P);
  await repo.transactions.create({ kind: 'expense', amount: 40000, currency: 'CLP', account_id: 'a_kart', occurred_on: today(), merchant: 'Lider' });
  const sonra = await repo.summary.month(P);
  assert.equal(sonra.expense, once.expense + 40000);
  assert.equal(sonra.personal.total, once.personal.total);
});

test('aile limiti kişisel harcamayı saymaz', async () => {
  const repo = depo();
  await repo.budgets.set({ period: P, category_id: null, amount_base: 1000000 });
  const once = (await repo.summary.budgetStatus(P)).find((b) => b.category_id === null).spent;
  await repo.transactions.create({ kind: 'expense', amount: 7000, currency: 'CLP', account_id: 'a_kart', occurred_on: today(), for_member_id: 'm_baba' });
  const sonra = (await repo.summary.budgetStatus(P)).find((b) => b.category_id === null).spent;
  assert.equal(sonra, once);
});

test('kişisel limit kaydedilir ve kaldırılabilir', async () => {
  const repo = depo();
  await repo.budgets.setPersonalLimit(150000);
  assert.equal((await repo.summary.month(P)).personal.limit, 150000);
  await repo.budgets.setPersonalLimit(0);
  assert.equal((await repo.summary.month(P)).personal.limit, null);
});

test('rapor iki kapsamda: aile ve kişisel ayrı', async () => {
  const repo = depo();
  await repo.transactions.create({ kind: 'expense', amount: 9000, currency: 'CLP', account_id: 'a_kart', occurred_on: today(), for_member_id: 'm_baba' });
  const aile = await repo.summary.trend(P, 1, 'family');
  const kisi = await repo.summary.trend(P, 1, 'personal');
  const m = await repo.summary.month(P);
  assert.equal(aile.months[0].expense, m.expense);
  assert.equal(kisi.months[0].expense, m.personal.total);
  assert.equal(kisi.months[0].income, 0, 'kişisel raporda gelir yok');
});

test('özet artık üyeye göre dağılım döndürmüyor', async () => {
  const m = await depo().summary.month(P);
  assert.equal('by_member' in m, false);
});

test('harcama formunda tek dokunuşluk Aile / Kişisel seçimi var, eski "kim için" listesi yok', () => {
  const q = readFileSync(new URL('../components/QuickAdd.jsx', import.meta.url), 'utf8');
  assert.match(q, /t\('money\.personal'\)/);
  assert.doesNotMatch(q, /t\('money\.forWhom'\)/);
});
