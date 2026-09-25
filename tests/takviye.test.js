// tests/takviye.test.js — günlük takviyeler (0022).
//
// SQL tarafındaki kuralların aynası: tavan per_day, sıfıra inince kayıt
// silinir, oran "alınan doz / alınması gereken doz". Katalog testleri de
// burada: iki dil ve emoji eksikse ekranda boş düğme çıkar.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import makeDemoRepo from '../lib/data/demoRepo.js';
import {
  SUPPLEMENT_GROUPS, SUPPLEMENT_CATALOG, supplementName, findSupplement,
} from '../lib/supplementCatalog.js';

const PZT = '2026-09-21';
const SAL = '2026-09-22';

function tazeDepo() {
  const repo = makeDemoRepo();
  repo.reset('tr');
  return repo;
}

test('katalog: her takviyenin iki dilde adı, emojisi ve bölümü var', () => {
  const eksik = SUPPLEMENT_CATALOG.filter((x) => !x.tr || !x.es || !x.emoji || !x.key || !x.group);
  assert.deepEqual(eksik.map((x) => x.key || '(anahtarsız)'), []);
});

test('katalog: anahtarlar benzersiz', () => {
  const seen = new Set(); const tekrar = [];
  for (const x of SUPPLEMENT_CATALOG) { if (seen.has(x.key)) tekrar.push(x.key); seen.add(x.key); }
  assert.deepEqual(tekrar, []);
});

test('katalog: her takviye tanımlı bir bölümde, her bölümde takviye var', () => {
  const g = new Set(SUPPLEMENT_GROUPS.map((x) => x.key));
  assert.deepEqual(SUPPLEMENT_CATALOG.filter((x) => !g.has(x.group)).map((x) => x.key), []);
  assert.deepEqual(
    SUPPLEMENT_GROUPS.filter((x) => !SUPPLEMENT_CATALOG.some((y) => y.group === x.key)).map((x) => x.key), []);
});

test('katalog: kullanıcının saydığı takviyeler var', () => {
  // "creatine, glutamine... vb" — istek buydu; listeden düşerlerse fark edilsin.
  for (const k of ['creatine', 'glutamine', 'whey', 'magnesium', 'omega3', 'vitamin_d']) {
    assert.ok(findSupplement(k), k + ' katalogdan düşmüş');
  }
});

test('katalog: reçeteli ilaç yok — bu bir ilaç takibi değil', () => {
  // CLAUDE.md sınırı: tıbbi içerik (tanı, ilaç) saklanmıyor. Katalog yalnızca
  // günlük takviye içeriyor; biri buraya ilaç eklemeye kalkarsa test düşsün.
  const yasak = /antibiyotik|antibi|insulin|insülin|warfarin|metformin|statin|antidepres/i;
  assert.deepEqual(SUPPLEMENT_CATALOG.filter((x) => yasak.test(x.tr) || yasak.test(x.es)).map((x) => x.key), []);
});

test('ad: dile göre seçiliyor', () => {
  const k = findSupplement('creatine');
  assert.equal(supplementName(k, 'tr'), 'Kreatin');
  assert.equal(supplementName(k, 'es-CL'), 'Creatina');
});

test('bir dokunuş bir doz; tavanı aşmıyor', async () => {
  const repo = tazeDepo();
  const s = await repo.personal.addSupplement({ title: 'Kreatin', per_day: 2, dose: '5 g' });
  assert.equal(await repo.personal.takeSupplement(s.id, 1, PZT), 1);
  assert.equal(await repo.personal.takeSupplement(s.id, 1, PZT), 2);
  // Üçüncü dokunuş: günde iki kez alınan bir şey üç kez alınmış görünmemeli.
  assert.equal(await repo.personal.takeSupplement(s.id, 1, PZT), 2);
  const v = await repo.personal.supplements(PZT);
  assert.equal(v.items[0].done, true);
});

test('yanlış dokunuş geri alınabilir, sıfırda kayıt kalmaz', async () => {
  const repo = tazeDepo();
  const s = await repo.personal.addSupplement({ title: 'Glutamin', per_day: 1 });
  await repo.personal.takeSupplement(s.id, 1, PZT);
  assert.equal(await repo.personal.takeSupplement(s.id, -1, PZT), 0);
  const v = await repo.personal.supplements(PZT);
  assert.equal(v.items[0].taken, 0);
  assert.equal(v.items[0].done, false);
  // Sıfırın altına düşmüyor: eksiye inen bir sayaç oranı bozardı.
  assert.equal(await repo.personal.takeSupplement(s.id, -1, PZT), 0);
});

test('oran: hiç takviye yoksa oran yok (sıfır değil)', async () => {
  const repo = tazeDepo();
  const v = await repo.personal.supplements(PZT);
  assert.equal(v.adherence7, null);
  assert.deepEqual(v.items, []);
});

test('oran: alınan doz / alınması gereken doz', async () => {
  const repo = tazeDepo();
  const s = await repo.personal.addSupplement({ title: 'D vitamini', per_day: 1 });
  await repo.personal.takeSupplement(s.id, 1, PZT);
  await repo.personal.takeSupplement(s.id, 1, SAL);
  // 7 günde 7 doz gerekiyordu, 2 alındı.
  const v = await repo.personal.supplements(SAL);
  assert.equal(v.adherence7, Math.round((100 * 2) / 7));
});

test('kaldırılan takviye listeden çıkar ama geçmiş kaydı oranı bozmaz', async () => {
  const repo = tazeDepo();
  const s = await repo.personal.addSupplement({ title: 'Geçici', per_day: 1 });
  await repo.personal.takeSupplement(s.id, 1, PZT);
  await repo.personal.removeSupplement(s.id);
  const v = await repo.personal.supplements(PZT);
  assert.deepEqual(v.items, []);
  // Payda da pay da düştüğü için oran hesaplanamaz hale gelir, %0 çıkmaz.
  assert.equal(v.adherence7, null);
});

test('günde iki kez alınan takviyede yarısı "tamam" sayılmaz', async () => {
  const repo = tazeDepo();
  const s = await repo.personal.addSupplement({ title: 'Magnezyum', per_day: 2 });
  await repo.personal.takeSupplement(s.id, 1, PZT);
  const v = await repo.personal.supplements(PZT);
  assert.equal(v.items[0].taken, 1);
  assert.equal(v.items[0].done, false);
});
