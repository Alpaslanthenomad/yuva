// tests/oneriler.test.js — akıllı önerilerin kuralları (0024'ün aynası).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { harcamaOnerileri, bitmisOlabilir } from '../lib/oneriler.js';

const D = '2026-09-26';   // cumartesi
const gider = (merchant, amount, occurred_on, extra = {}) => ({
  kind: 'expense', merchant, amount, currency: 'CLP', occurred_on, category_id: 'market', account_id: 'acc', ...extra,
});

test('harcama önerisi: tek seferlik harcama alışkanlık değildir', () => {
  assert.deepEqual(harcamaOnerileri([gider('Eltit', 17000, '2026-09-20')], D), []);
});

test('harcama önerisi: tutar ortanca — tek büyük alışveriş kaydırmaz', () => {
  const r = harcamaOnerileri([
    gider('Lider', 40000, '2026-09-19'), gider('Lider', 38000, '2026-09-12'), gider('Lider', 150000, '2026-09-05'),
  ], D);
  assert.equal(r.length, 1);
  assert.equal(r[0].amount, 40000);
  assert.equal(r[0].uses, 3);
});

test('harcama önerisi: yazım farkı aynı yer sayılır', () => {
  const r = harcamaOnerileri([gider('Lider', 40000, '2026-09-19'), gider(' lider ', 42000, '2026-09-10')], D);
  assert.equal(r.length, 1);
  assert.equal(r[0].merchant, 'Lider');   // en son yazılış biçimi
});

test('harcama önerisi: otomatik düzenli gider ve gelir öneri olmaz', () => {
  const r = harcamaOnerileri([
    gider('Kira', 500000, '2026-09-01', { recurring_id: 'r1' }), gider('Kira', 500000, '2026-08-01', { recurring_id: 'r1' }),
    { ...gider('Maaş', 1, '2026-09-01'), kind: 'income' }, { ...gider('Maaş', 1, '2026-08-01'), kind: 'income' },
  ], D);
  assert.deepEqual(r, []);
});

test('harcama önerisi: 120 günden eski harcama sayılmaz', () => {
  assert.deepEqual(harcamaOnerileri([gider('Jumbo', 30000, '2026-01-10'), gider('Jumbo', 30000, '2026-01-20')], D), []);
});

test('harcama önerisi: yakın ve bugünün gününe denk gelen üstte', () => {
  const r = harcamaOnerileri([
    gider('Eski', 1000, '2026-06-10'), gider('Eski', 1000, '2026-06-12'),
    gider('Cumartesi', 2000, '2026-09-19'), gider('Cumartesi', 2000, '2026-09-12'),
  ], D);
  assert.equal(r[0].merchant, 'Cumartesi');
});

test('bitmiş olabilir: aralık dolunca önerilir', () => {
  const log = ['2026-09-10', '2026-09-15', '2026-09-20'].map((d) => ({ catalog_key: 'milk', added_on: d }));
  const r = bitmisOlabilir(log, D);
  assert.deepEqual(r, [{ catalog_key: 'milk', every_days: 5, days_since: 6 }]);
});

test('bitmiş olabilir: aralık dolmadıysa sessiz', () => {
  const log = ['2026-09-16', '2026-09-21', '2026-09-24'].map((d) => ({ catalog_key: 'milk', added_on: d }));
  assert.deepEqual(bitmisOlabilir(log, D), []);
});

test('bitmiş olabilir: iki günlük veriyle tahmin yok', () => {
  const log = ['2026-09-10', '2026-09-15'].map((d) => ({ catalog_key: 'milk', added_on: d }));
  assert.deepEqual(bitmisOlabilir(log, D), []);
});

test('bitmiş olabilir: her gün alınan şey gürültü olmasın', () => {
  const log = ['2026-09-23', '2026-09-24', '2026-09-25'].map((d) => ({ catalog_key: 'bread', added_on: d }));
  assert.deepEqual(bitmisOlabilir(log, '2026-09-27'), []);
});

test('bitmiş olabilir: en gecikmiş olan önce', () => {
  const log = [
    ...['2026-09-01', '2026-09-08', '2026-09-15'].map((d) => ({ catalog_key: 'rice', added_on: d })),    // 7g, 11g geçti
    ...['2026-09-10', '2026-09-15', '2026-09-20'].map((d) => ({ catalog_key: 'milk', added_on: d })),    // 5g, 6g geçti
  ];
  assert.deepEqual(bitmisOlabilir(log, D).map((x) => x.catalog_key), ['rice', 'milk']);
});
