import { test } from 'node:test';
import assert from 'node:assert/strict';
import { startOfWeek, weekDays, monthGrid, expandRRule, nextOccurrence, dayInRange, nextOccasionDate, overlaps, addMonths, relativeLabel } from '../lib/dates.js';
import { easterSunday, holidaysCL, holidaysTR, holidayMap } from '../lib/holidays.js';

test('startOfWeek Pazartesi', () => {
  assert.equal(startOfWeek('2026-09-20'), '2026-09-14'); // Pazar → önceki Pzt
  assert.equal(startOfWeek('2026-09-14'), '2026-09-14');
  assert.equal(weekDays('2026-09-17')[6], '2026-09-20');
});
test('monthGrid 42 hücre, ilk hücre Pazartesi', () => {
  const g = monthGrid('2026-09');
  assert.equal(g.length, 42);
  assert.equal(g[0], '2026-08-31');
});
test('addMonths ay sonu taşması', () => {
  assert.equal(addMonths('2026-01-31', 1).slice(0, 7), '2026-03'); // JS davranışı; period için yeterli
});
test('expandRRule haftalık BYDAY', () => {
  const r = expandRRule('FREQ=WEEKLY;BYDAY=MO,TH', '2026-09-14', '2026-09-14', '2026-09-27');
  assert.deepEqual(r, ['2026-09-14', '2026-09-17', '2026-09-21', '2026-09-24']);
});
test('expandRRule haftalık BYDAY yok — kendi gününde kalır', () => {
  // 2026-09-23 Çarşamba. Tekrarlar da Çarşamba olmalı, Pazartesi'ye kaymamalı.
  const r = expandRRule('FREQ=WEEKLY', '2026-09-23', '2026-09-23', '2026-10-20');
  assert.deepEqual(r, ['2026-09-23', '2026-09-30', '2026-10-07', '2026-10-14']);
});
test('expandRRule iki haftada bir — kendi gününde kalır', () => {
  const r = expandRRule('FREQ=WEEKLY;INTERVAL=2', '2026-09-23', '2026-09-23', '2026-11-01');
  assert.deepEqual(r, ['2026-09-23', '2026-10-07', '2026-10-21']);
});
test('expandRRule haftalık BYDAY + INTERVAL=2', () => {
  const r = expandRRule('FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,TH', '2026-09-14', '2026-09-14', '2026-10-04');
  assert.deepEqual(r, ['2026-09-14', '2026-09-17', '2026-09-28', '2026-10-01']);
});
test('expandRRule aylık + COUNT + exdate', () => {
  const r = expandRRule('FREQ=MONTHLY;COUNT=3', '2026-01-31', '2026-01-01', '2026-12-31', ['2026-02-28']);
  assert.deepEqual(r, ['2026-01-31', '2026-03-31']);
});
test('expandRRule tekrarsız olay aralık dışı', () => {
  assert.deepEqual(expandRRule(null, '2026-09-10', '2026-09-14', '2026-09-20'), []);
  assert.deepEqual(expandRRule(null, '2026-09-15', '2026-09-14', '2026-09-20'), ['2026-09-15']);
});
test('nextOccasionDate yıl devri', () => {
  assert.deepEqual(nextOccasionDate(10, 5, '2026-09-20'), { date: '2026-10-05', daysLeft: 15 });
  assert.equal(nextOccasionDate(3, 14, '2026-09-20').date, '2027-03-14');
});
test('overlaps', () => {
  assert.equal(overlaps('2026-09-20T10:00:00Z', '2026-09-20T11:00:00Z', '2026-09-20T10:30:00Z', '2026-09-20T12:00:00Z'), true);
  assert.equal(overlaps('2026-09-20T10:00:00Z', '2026-09-20T11:00:00Z', '2026-09-20T11:00:00Z', '2026-09-20T12:00:00Z'), false);
});
test('relativeLabel', () => {
  assert.equal(relativeLabel('2026-09-20', '2026-09-20'), 'Bugün');
  assert.equal(relativeLabel('2026-09-21', '2026-09-20'), 'Yarın');
  assert.equal(relativeLabel('2026-09-25', '2026-09-20'), '5 gün sonra');
});
test('easter ve tatiller', () => {
  assert.equal(easterSunday(2026), '2026-04-05');
  assert.equal(easterSunday(2027), '2027-03-28');
  const cl = holidaysCL(2026);
  assert.ok(cl.find((h) => h.date === '2026-09-18' && h.key === 'cl_patrias'));
  assert.ok(cl.find((h) => h.date === '2026-04-03' && h.key === 'cl_goodfriday'));
  const tr = holidaysTR(2026);
  assert.ok(tr.find((h) => h.date === '2026-10-29' && h.key === 'tr_cumhuriyet'));
  const map = holidayMap(2026, ['CL', 'TR']);
  assert.equal(map['2026-01-01'].length, 2); // iki ülkede de yılbaşı
  assert.equal(holidayMap(2026, ['TR'])['2026-09-18'], undefined);
});

test('expandRRule exdate: tek gün atlanır, seri bozulmaz', () => {
  // 23 Eylül Çarşamba haftalık; 7 Ekim atlanmış olsun.
  const r = expandRRule('FREQ=WEEKLY', '2026-09-23', '2026-09-23', '2026-10-20', ['2026-10-07']);
  assert.deepEqual(r, ['2026-09-23', '2026-09-30', '2026-10-14']);
});
test('expandRRule exdate BYDAY ile de çalışır', () => {
  const r = expandRRule('FREQ=WEEKLY;BYDAY=MO,TH', '2026-09-14', '2026-09-14', '2026-09-27', ['2026-09-17', '2026-09-21']);
  assert.deepEqual(r, ['2026-09-14', '2026-09-24']);
});

test('nextOccurrence: haftalık görev bir sonraki haftaya taşınır', () => {
  assert.equal(nextOccurrence('FREQ=WEEKLY', '2026-09-23'), '2026-09-30');
  assert.equal(nextOccurrence('FREQ=WEEKLY;INTERVAL=2', '2026-09-23'), '2026-10-07');
});
test('nextOccurrence: aylık ve günlük', () => {
  assert.equal(nextOccurrence('FREQ=DAILY', '2026-09-23'), '2026-09-24');
  // Şubatta 31 yok: kural ayın sonuna kırpılır (ay atlanmaz). Aylık bir ev işi
  // için doğru davranış bu — "her ayın sonu" beklenir, şubat boş geçmez.
  assert.equal(nextOccurrence('FREQ=MONTHLY', '2026-01-31'), '2026-02-28');
  assert.equal(nextOccurrence('FREQ=MONTHLY', '2026-02-28'), '2026-03-28');
});
test('nextOccurrence: BYDAY ile hafta içi sıradaki gün', () => {
  // Pazartesi/Perşembe kuralı, Pazartesi 14 Eylül'den sonrası → Perşembe 17 Eylül
  assert.equal(nextOccurrence('FREQ=WEEKLY;BYDAY=MO,TH', '2026-09-14'), '2026-09-17');
});
test('nextOccurrence: kural yoksa veya vade yoksa null', () => {
  assert.equal(nextOccurrence(null, '2026-09-23'), null);
  assert.equal(nextOccurrence('FREQ=WEEKLY', null), null);
});
test('nextOccurrence: UNTIL geçtiyse null', () => {
  assert.equal(nextOccurrence('FREQ=WEEKLY;UNTIL=20260925', '2026-09-23'), null);
});

test('dayInRange: plan aralığında kaçıncı gün', () => {
  assert.deepEqual(dayInRange('2026-10-03', '2026-10-01', '2026-10-05'), { day: 3, total: 5 });
  assert.deepEqual(dayInRange('2026-10-01', '2026-10-01', '2026-10-01'), { day: 1, total: 1 });
  assert.equal(dayInRange('2026-09-30', '2026-10-01', '2026-10-05'), null);
  assert.equal(dayInRange('2026-10-06', '2026-10-01', '2026-10-05'), null);
  // ends_on boşsa tek günlük sayılır
  assert.deepEqual(dayInRange('2026-10-01', '2026-10-01', null), { day: 1, total: 1 });
  assert.equal(dayInRange('2026-10-01', null, null), null);
});

test('expandRRule BYMONTHDAY: çapa kuralda, ay sonuna takılıp kalmaz', () => {
  // Hata: 31 Ocak → 28 Şubat'a kırpılınca çapa 28'e düşüyor ve görev bir daha
  // 31'e dönmüyordu. BYMONTHDAY çapayı sabitler.
  assert.equal(nextOccurrence('FREQ=MONTHLY;BYMONTHDAY=31', '2026-01-31'), '2026-02-28');
  assert.equal(nextOccurrence('FREQ=MONTHLY;BYMONTHDAY=31', '2026-02-28'), '2026-03-31');
  assert.equal(nextOccurrence('FREQ=MONTHLY;BYMONTHDAY=31', '2026-04-30'), '2026-05-31');
});
test('expandRRule BYMONTHDAY=-1: ayın son günü', () => {
  assert.equal(nextOccurrence('FREQ=MONTHLY;BYMONTHDAY=-1', '2026-01-31'), '2026-02-28');
  assert.equal(nextOccurrence('FREQ=MONTHLY;BYMONTHDAY=-1', '2026-02-28'), '2026-03-31');
  assert.equal(nextOccurrence('FREQ=MONTHLY;BYMONTHDAY=-1', '2026-11-30'), '2026-12-31');
});
