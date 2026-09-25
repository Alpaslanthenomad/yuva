// tests/gunum.test.js — kişisel gün planı ve hedefler (0021).
//
// Bu testler demo deposunu sürüyor ama asıl korudukları şey SQL'deki kurallar:
// demoRepo.personal, my_day / my_goals / goal_log_set fonksiyonlarının birebir
// aynasıdır. Buradaki bir kural bozulursa iki taraf da gözden geçirilmeli.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import makeDemoRepo from '../lib/data/demoRepo.js';

const PZT = '2026-09-21';   // pazartesi -> weekday
const SAL = '2026-09-22';
const CMT = '2026-09-26';   // cumartesi -> weekend

// Her test kendi deposuyla başlasın: demoRepo modül düzeyinde önbellek tutuyor.
function tazeDepo() {
  const repo = makeDemoRepo();
  repo.reset('tr');
  return repo;
}

test('gün planı: hafta içi ve hafta sonu şablonları ayrı', async () => {
  const repo = tazeDepo();
  await repo.personal.addBlock({ scope: 'weekday', title: 'Mesai', starts_at: '09:00', ends_at: '18:00' });
  await repo.personal.addBlock({ scope: 'weekend', title: 'Yürüyüş', starts_at: '10:00', ends_at: '11:00' });

  const haftaIci = await repo.personal.day(PZT);
  const haftaSonu = await repo.personal.day(CMT);

  assert.equal(haftaIci.scope, 'weekday');
  assert.deepEqual(haftaIci.blocks.map((b) => b.title), ['Mesai']);
  assert.equal(haftaSonu.scope, 'weekend');
  assert.deepEqual(haftaSonu.blocks.map((b) => b.title), ['Yürüyüş']);
});

test('gün planı: bloklar başlangıç saatine göre sıralı', async () => {
  const repo = tazeDepo();
  await repo.personal.addBlock({ scope: 'weekday', title: 'Akşam', starts_at: '20:00', ends_at: '21:00' });
  await repo.personal.addBlock({ scope: 'weekday', title: 'Sabah', starts_at: '06:00', ends_at: '07:00' });
  const gun = await repo.personal.day(PZT);
  assert.deepEqual(gun.blocks.map((b) => b.title), ['Sabah', 'Akşam']);
});

test('blok işareti geri alınabilir', async () => {
  const repo = tazeDepo();
  const blok = await repo.personal.addBlock({ scope: 'weekday', title: 'Okuma', starts_at: '22:00', ends_at: '23:00' });

  assert.equal((await repo.personal.day(PZT)).blocks[0].done, false);
  assert.equal(await repo.personal.toggleBlock(blok.id, PZT), true);
  assert.equal((await repo.personal.day(PZT)).blocks[0].done, true);
  // Yanlışlıkla işaretlemek serbest olmalı; ikinci dokunuş kaydı siler.
  assert.equal(await repo.personal.toggleBlock(blok.id, PZT), false);
  assert.equal((await repo.personal.day(PZT)).blocks[0].done, false);
});

test('blok silinince o bloğun geçmiş işaretleri de gider', async () => {
  const repo = tazeDepo();
  const blok = await repo.personal.addBlock({ scope: 'weekday', title: 'Geçici', starts_at: '08:00', ends_at: '09:00' });
  await repo.personal.toggleBlock(blok.id, PZT);
  await repo.personal.removeBlock(blok.id);
  // Kalan kayıt, tutturma oranını olmayan bir blok üzerinden şişirirdi.
  assert.equal((await repo.personal.day(PZT)).adherence7, null);
});

test('tutturma oranı: hiç blok yoksa oran yok (sıfır değil)', async () => {
  const repo = tazeDepo();
  // %0 göstermek "bugün başarısızsın" demek; plan kurmamış birine yanlış.
  assert.equal((await repo.personal.day(PZT)).adherence7, null);
});

test('tutturma oranı: bloğu olmayan gün paydaya girmez', async () => {
  const repo = tazeDepo();
  const blok = await repo.personal.addBlock({ scope: 'weekend', title: 'Yürüyüş', starts_at: '10:00', ends_at: '11:00' });
  // 2026-09-26 cumartesi; son 7 gün içinde yalnız 20 (cmt) ve 26 hafta sonu.
  await repo.personal.toggleBlock(blok.id, CMT);
  const gun = await repo.personal.day(CMT);
  // Hafta içi günler blok içermediği için paydada yok: 1/2 = %50.
  assert.equal(gun.adherence7, 50);
});

test('günlük hedef: bugünkü miktar hedefe oranlanır', async () => {
  const repo = tazeDepo();
  const h = await repo.personal.addGoal({ title: 'Okuma', kind: 'daily', target: 30, unit: 'dk' });
  await repo.personal.setGoal(h.id, 15, PZT);
  const [g] = (await repo.personal.goals(PZT)).filter((x) => x.id === h.id);
  assert.equal(g.today, 15);
  assert.equal(g.pct, 50);
});

test('günlük hedef: hedefin üstü %100de kesilir ama gerçek değer durur', async () => {
  const repo = tazeDepo();
  const h = await repo.personal.addGoal({ title: 'Okuma', kind: 'daily', target: 30, unit: 'dk' });
  await repo.personal.setGoal(h.id, 90, PZT);
  const [g] = (await repo.personal.goals(PZT)).filter((x) => x.id === h.id);
  assert.equal(g.pct, 100);     // çubuk taşmasın
  assert.equal(g.progress, 90); // ama ne yaptığını görebilelim
});

test('haftalık hedef: miktarı değil, kaç gün yapıldığını sayar', async () => {
  const repo = tazeDepo();
  const h = await repo.personal.addGoal({ title: 'Spor', kind: 'weekly', target: 3, unit: 'gün' });
  await repo.personal.setGoal(h.id, 5, PZT);   // aynı gün 5 birim
  await repo.personal.setGoal(h.id, 1, SAL);
  const [g] = (await repo.personal.goals(SAL)).filter((x) => x.id === h.id);
  // 6 değil 2: haftalık hedef "haftada kaç gün" demek.
  assert.equal(g.progress, 2);
});

test('haftalık hedef: sıfır yazmak o günü sayımdan düşürür', async () => {
  const repo = tazeDepo();
  const h = await repo.personal.addGoal({ title: 'Spor', kind: 'weekly', target: 3, unit: 'gün' });
  await repo.personal.setGoal(h.id, 1, PZT);
  await repo.personal.setGoal(h.id, 1, SAL);
  await repo.personal.setGoal(h.id, 0, SAL);  // "aslında yapmadım"
  const [g] = (await repo.personal.goals(SAL)).filter((x) => x.id === h.id);
  assert.equal(g.progress, 1);
});

test('toplam hedef: bütün günlerin miktarı birikir', async () => {
  const repo = tazeDepo();
  const h = await repo.personal.addGoal({ title: 'Kitap', kind: 'total', target: 12, unit: 'kitap' });
  await repo.personal.setGoal(h.id, 1, PZT);
  await repo.personal.setGoal(h.id, 2, SAL);
  const [g] = (await repo.personal.goals(SAL)).filter((x) => x.id === h.id);
  assert.equal(g.progress, 3);
  assert.equal(g.pct, 25);
});

test('hedef silinince kayıtları da silinir', async () => {
  const repo = tazeDepo();
  const h = await repo.personal.addGoal({ title: 'Geçici', kind: 'total', target: 10 });
  await repo.personal.setGoal(h.id, 4, PZT);
  await repo.personal.removeGoal(h.id);
  assert.equal((await repo.personal.goals(PZT)).some((g) => g.id === h.id), false);

  // Aynı başlıkla yeni hedef kurulursa eski ilerleme geri gelmemeli.
  const yeni = await repo.personal.addGoal({ title: 'Geçici', kind: 'total', target: 10 });
  const [g] = (await repo.personal.goals(PZT)).filter((x) => x.id === yeni.id);
  assert.equal(g.progress, 0);
});
