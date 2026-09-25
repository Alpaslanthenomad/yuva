// tests/album.test.js — günün karesi ve fotoğraf küçültme kuralları.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gununSirasi, olcekle, sahne, selamAnahtari, ALBUM_EPOCH } from '../lib/album.js';

test('günün karesi: aynı gün hep aynı sıra (rastgele değil)', () => {
  assert.equal(gununSirasi('2026-09-26', 7), gununSirasi('2026-09-26', 7));
});

test('günün karesi: ardışık günler sırayla döner, hepsi gelmeden tekrar yok', () => {
  const gunler = ['2026-09-26', '2026-09-27', '2026-09-28', '2026-09-29', '2026-09-30'];
  const sira = gunler.map((d) => gununSirasi(d, 5));
  assert.equal(new Set(sira).size, 5);
  for (let i = 1; i < sira.length; i += 1) assert.equal(sira[i], (sira[i - 1] + 1) % 5);
});

test('günün karesi: fotoğraf yoksa -1, tek fotoğrafta hep 0', () => {
  assert.equal(gununSirasi('2026-09-26', 0), -1);
  assert.equal(gununSirasi('2026-09-26', 1), 0);
  assert.equal(gununSirasi('2023-05-01', 3) >= 0, true);   // başlangıçtan önceki gün de eksiye düşmez
});

test('günün karesi: başlangıç günü SQL ile aynı', () => {
  // 0023 photo_of_day aynı günü kullanıyor; biri değişirse demo ile gerçek
  // kip farklı fotoğraf gösterir.
  const sql = readFileSync(new URL('../supabase/migrations/0023_aile_albumu.sql', import.meta.url), 'utf8');
  assert.ok(sql.includes(`date '${ALBUM_EPOCH}'`));
});

test('küçültme: en uzun kenar 1600, oran korunur', () => {
  assert.deepEqual(olcekle(4032, 3024), { w: 1600, h: 1200 });
  assert.deepEqual(olcekle(3024, 4032), { w: 1200, h: 1600 });
});

test('küçültme: küçük fotoğraf büyütülmez', () => {
  assert.deepEqual(olcekle(800, 600), { w: 800, h: 600 });
});

test('sahne: saate göre dört hal', () => {
  assert.equal(sahne(6), 'dawn');
  assert.equal(sahne(13), 'day');
  assert.equal(sahne(19), 'dusk');
  assert.equal(sahne(23), 'night');
  assert.equal(sahne(2), 'night');
});

test('selam: saate göre', () => {
  assert.equal(selamAnahtari(7), 'today.hello.morning');
  assert.equal(selamAnahtari(15), 'today.hello.afternoon');
  assert.equal(selamAnahtari(20), 'today.hello.evening');
  assert.equal(selamAnahtari(1), 'today.hello.night');
});

test('albüm özel: bucket herkese açık değil, dosyalar hane klasöründe', () => {
  const sql = readFileSync(new URL('../supabase/migrations/0023_aile_albumu.sql', import.meta.url), 'utf8');
  assert.match(sql, /values \('album', 'album', false/);
  assert.match(sql, /check \(public\.album_hid\(path\) = household_id\)/);
});

test('çıkışta albümün imzalı adresleri cihazdan silinir', () => {
  const src = readFileSync(new URL('../lib/data/offlineCache.js', import.meta.url), 'utf8');
  assert.match(src, /yuva:album-url:/);
});
