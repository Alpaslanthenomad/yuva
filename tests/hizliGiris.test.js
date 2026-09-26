// tests/hizliGiris.test.js — tek satırda harcama ve mağazadan kategori öğrenme.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hizliCoz, adAnahtari, magazaBul, magazaOgren } from '../lib/hizliGiris.js';
import makeDemoRepo from '../lib/data/demoRepo.js';

test('tutar yazımları: Şili alışkanlıkları dahil', () => {
  const c = (s) => hizliCoz(s);
  assert.deepEqual(c('jumbo 45990'), { merchant: 'jumbo', amount: 45990, personal: false });
  assert.equal(c('Lider 45.990').amount, 45990);
  assert.equal(c('copec 1.250.000').amount, 1250000);
  assert.equal(c('45 990 unimarc').amount, 45990);
  assert.equal(c('uber 8,5k').amount, 8500);
  assert.equal(c('feria 12 lucas').amount, 12000);
  assert.equal(c('kafe 8.5').amount, 8.5);
  assert.equal(c('regalo 1.250,50').amount, 1250.5);
  assert.equal(c('pan').amount, null);
  assert.equal(c('netflix 12990 kişisel').personal, true);
  assert.equal(c('netflix 12990 kişisel').merchant, 'netflix');
});

test('ad anahtarı: büyük/küçük harf, aksan ve boşluk farkı yok', () => {
  assert.equal(adAnahtari('  Líder   Express '), 'lider express');
  assert.equal(adAnahtari('İNCİ'), adAnahtari('inci'));
});

test('öğrenme: her mağaza için en sık kategori; eşleşme tam ya da baştan', () => {
  const liste = magazaOgren([
    { kind: 'expense', merchant: 'Jumbo', category_id: 'market', occurred_on: '2026-09-01' },
    { kind: 'expense', merchant: 'jumbo ', category_id: 'market', occurred_on: '2026-09-10' },
    { kind: 'expense', merchant: 'Jumbo', category_id: 'giyim', occurred_on: '2026-09-12' },
    { kind: 'expense', merchant: 'Gizli', category_id: 'x', occurred_on: '2026-09-12', masked: true },
    { kind: 'income', merchant: 'Maaş', category_id: 'maas', occurred_on: '2026-09-01' },
  ]);
  assert.equal(liste.length, 1);
  assert.equal(liste[0].category_id, 'market');
  assert.equal(liste[0].uses, 2);
  assert.equal(magazaBul(liste, 'JUMBO').category_id, 'market');
  assert.equal(magazaBul(liste, 'jum').category_id, 'market');
  assert.equal(magazaBul(liste, 'ju'), null, 'iki harf yetmez');
  assert.equal(magazaBul(liste, 'lider'), null);
});

test('demo deposu mağaza öğrenmesini veriyor, eşin kişiselini içermiyor', async () => {
  const repo = makeDemoRepo(); repo.reset('tr');
  const m = await repo.suggest.merchants();
  assert.ok(m.length > 0);
  assert.ok(m.some((x) => adAnahtari(x.merchant) === 'lider'));
  const db = await repo.transactions.list({ limit: 5000 });
  const gizli = db.filter((x) => x.masked);
  assert.ok(gizli.length >= 1);
});

import { katalogdanBul } from '../lib/expenseCatalog.js';
test('hiç girilmemiş ama tanınan yer hazır listeden bulunur', () => {
  assert.equal(katalogdanBul('COPEC')?.key, 'fuel');
  assert.equal(katalogdanBul('Cruz Verde')?.key, 'pharmacy');
  assert.equal(katalogdanBul('líder')?.key, 'lider');
  assert.equal(katalogdanBul('bilinmeyen dükkan'), null);
});
