// tests/gunCatalog.test.js — Günüm hazır blok ve hedef kataloğu.
//
// Izgarada boş düğme çıkmasın (iki dil + emoji), saatler veritabanı
// kısıtına uysun (bitiş > başlangıç, gece yarısını aşmadan), örnek gün
// yalnızca var olan bloklara işaret etsin.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  BLOCK_GROUPS, BLOCK_CATALOG, STARTER_DAY, GOAL_GROUPS, GOAL_CATALOG,
  itemName, goalUnit, findBlock, dakika, cakisiyor, sure,
} from '../lib/gunCatalog.js';

const SAAT = /^([01]\d|2[0-3]):[0-5]\d$/;

test('bloklar: iki dilde ad, emoji, geçerli bölüm ve saat', () => {
  const gruplar = new Set(BLOCK_GROUPS.map((g) => g.key));
  const bozuk = BLOCK_CATALOG.filter((x) => !x.key || !x.tr || !x.es || !x.emoji || !gruplar.has(x.group)
    || !SAAT.test(x.from) || !SAAT.test(x.to) || dakika(x.to) <= dakika(x.from));
  assert.deepEqual(bozuk.map((x) => x.key), []);
});

test('bloklar: anahtarlar benzersiz, her bölümde en az 4 seçenek', () => {
  const keys = BLOCK_CATALOG.map((x) => x.key);
  assert.equal(new Set(keys).size, keys.length);
  for (const g of BLOCK_GROUPS) {
    assert.ok(g.tr && g.es && g.emoji, g.key);
    assert.ok(BLOCK_CATALOG.filter((x) => x.group === g.key).length >= 4, g.key);
  }
});

test('örnek gün: var olan bloklar, sıralı ve çakışmasız', () => {
  for (const scope of ['weekday', 'weekend']) {
    const liste = STARTER_DAY[scope].map(findBlock);
    assert.ok(liste.every(Boolean), scope);
    for (let i = 1; i < liste.length; i++) {
      assert.ok(dakika(liste[i].from) >= dakika(liste[i - 1].to), `${scope}: ${liste[i - 1].key} → ${liste[i].key}`);
    }
  }
});

test('hedefler: iki dilde ad ve birim, geçerli tür ve pozitif hedef', () => {
  const gruplar = new Set(GOAL_GROUPS.map((g) => g.key));
  const bozuk = GOAL_CATALOG.filter((x) => !x.tr || !x.es || !x.emoji || !gruplar.has(x.group)
    || !['daily', 'weekly', 'total'].includes(x.kind) || !(x.target > 0) || !x.unitTr || !x.unitEs
    || (x.kind === 'weekly' && x.target > 7));
  assert.deepEqual(bozuk.map((x) => x.key), []);
  assert.equal(new Set(GOAL_CATALOG.map((x) => x.key)).size, GOAL_CATALOG.length);
});

test('yardımcılar: dil, çakışma ve süre', () => {
  const x = findBlock('reading');
  assert.equal(itemName(x, 'tr'), 'Kitap okuma');
  assert.equal(itemName(x, 'es-CL'), 'Lectura');
  assert.equal(goalUnit(GOAL_CATALOG[0], 'es'), 'minutos');
  assert.equal(cakisiyor('09:00', '10:00', '09:30', '11:00'), true);
  assert.equal(cakisiyor('09:00', '10:00', '10:00', '11:00'), false);
  assert.equal(sure('09:00', '10:30', 'tr'), '1 sa 30 dk');
  assert.equal(sure('09:00', '09:45', 'es'), '45 min');
  assert.equal(sure('09:00', '11:00', 'tr'), '2 sa');
});
