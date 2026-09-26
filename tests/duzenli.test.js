// tests/duzenli.test.js — düzenli ödemeler: vade ilerletme, Ödendi, Atla (0033).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import makeDemoRepo from '../lib/data/demoRepo.js';
import { sonrakiVade, DUZENLI_ONERILER } from '../lib/expenseCatalog.js';
import { today, addDays } from '../lib/dates.js';

test('sonraki vade: ay sonu taşması Postgres gibi, hafta ve yıl', () => {
  assert.equal(sonrakiVade('FREQ=MONTHLY', '2026-01-31'), '2026-02-28');
  assert.equal(sonrakiVade('FREQ=MONTHLY', '2026-10-05'), '2026-11-05');
  assert.equal(sonrakiVade('FREQ=MONTHLY', '2026-12-15'), '2027-01-15');
  assert.equal(sonrakiVade('FREQ=WEEKLY', '2026-09-28'), '2026-10-05');
  assert.equal(sonrakiVade('FREQ=YEARLY', '2027-06-02'), '2028-06-02');
});

test('hazır düzenli ödemeler iki dilde ve sıklıklı', () => {
  for (const p of DUZENLI_ONERILER) assert.ok(p.tr && p.es && p.emoji && p.freq && p.cat, p.key);
});

test('Ödendi: harcama yazılır, vade bir dönem ilerler; Atla: yalnızca vade ilerler', async () => {
  const repo = makeDemoRepo(); repo.reset('tr');
  const vade = addDays(today(), -2);
  const r = await repo.recurring.create({ name: 'Kira test', amount: 950000, currency: 'CLP', account_id: 'a_bci', next_due_on: vade, rrule: 'FREQ=MONTHLY', auto_post: false });
  const once = (await repo.transactions.list({ limit: 5000 })).length;
  const t = await repo.recurring.pay(r.id);
  assert.equal(t.merchant, 'Kira test');
  assert.equal(t.recurring_id, r.id);
  assert.equal((await repo.transactions.list({ limit: 5000 })).length, once + 1);
  const r2 = (await repo.recurring.list()).find((x) => x.id === r.id);
  const odemeSonrasi = r2.next_due_on;
  assert.equal(odemeSonrasi, sonrakiVade('FREQ=MONTHLY', vade));
  const atla = await repo.recurring.skip(r.id);
  assert.equal(atla, sonrakiVade('FREQ=MONTHLY', odemeSonrasi));
  assert.equal((await repo.transactions.list({ limit: 5000 })).length, once + 1, 'atlamak harcama yazmaz');
});

test('gecikmiş ve otomatik olmayan ödeme Bugün ekranında görünür', async () => {
  const repo = makeDemoRepo(); repo.reset('tr');
  await repo.recurring.create({ name: 'Gecikmiş', amount: 1000, currency: 'CLP', next_due_on: addDays(today(), -5), rrule: 'FREQ=MONTHLY', auto_post: false });
  const a = await repo.summary.agenda(today(), 7);
  assert.ok(a.bills.some((b) => b.name === 'Gecikmiş'));
});
