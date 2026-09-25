import { test } from 'node:test';
import assert from 'node:assert/strict';
import { trendSeries, trendStats, changePct, vsAverage, categoryRows, isEmptyTrend } from '../lib/report.js';

const ay = (period, expense = 0, income = 0, fixed = 0) =>
  ({ period, expense, income, fixed, variable: expense - fixed, net: income - expense });

// Hane temmuzda kuruldu: nisan-haziran boş, sonra hareket var.
const YENI_HANE = [
  ay('2026-04'), ay('2026-05'), ay('2026-06'),
  ay('2026-07', 100, 300), ay('2026-08', 200, 300), ay('2026-09', 300, 300),
];

test('boş pencerede yüzdeler 0 — sıfıra bölünmüyor', () => {
  const s = trendSeries([ay('2026-04'), ay('2026-05')], 'expense');
  assert.deepEqual(s.map((x) => x.pct), [0, 0]);
  assert.ok(s.every((x) => Number.isFinite(x.pct)));
});

test('yüzdeler pencerenin tepesine göre; en yüksek ay %100', () => {
  const s = trendSeries(YENI_HANE, 'expense');
  assert.deepEqual(s.map((x) => Math.round(x.pct)), [0, 0, 0, 33, 67, 100]);
});

test('eksi net çizilebilir kalır — ölçek mutlak değerle kurulur', () => {
  // Gideri gelirinden fazla olan bir ay: net -500. Ölçek mutlak değere göre
  // kurulmazsa bu ay %0 çıkar ve grafikte hiç görünmez.
  const s = trendSeries([ay('2026-08', 100, 600), ay('2026-09', 500, 0)], 'net');
  assert.deepEqual(s.map((x) => x.value), [500, -500]);
  assert.deepEqual(s.map((x) => Math.round(x.pct)), [100, 100]);
});

test('ORTALAMA İLK HAREKETTEN İTİBAREN — boş başlangıç aylarını saymaz', () => {
  // Asıl mesele: hane 3 ay önce kuruldu. 6 aya bölersek "aylık ortalama
  // gideriniz 100" çıkar; doğrusu 200'dür. Bütçe konuşması yanlış sayının
  // üstüne kurulmasın.
  const st = trendStats(YENI_HANE);
  assert.equal(st.months, 3);
  assert.equal(st.totalExpense, 600);
  assert.equal(st.avgExpense, 200);
  assert.equal(st.avgIncome, 300);
  assert.equal(st.net, 300);
});

test('ARADAKİ boş ay gerçek sıfırdır ve ortalamaya girer', () => {
  // Baştaki boşluk "henüz yoktuk", aradaki boşluk "o ay harcamadık".
  const st = trendStats([ay('2026-07', 300), ay('2026-08', 0), ay('2026-09', 300)]);
  assert.equal(st.months, 3);
  assert.equal(st.avgExpense, 200);
});

test('hiç hareket yoksa ortalama 0, bölme yok', () => {
  const st = trendStats([ay('2026-08'), ay('2026-09')]);
  assert.equal(st.months, 0);
  assert.equal(st.avgExpense, 0);
  assert.ok(Number.isFinite(st.avgExpense));
  assert.equal(trendStats([]).avgExpense, 0);
});

test('changePct: taban 0 ise null — "%sonsuz arttı" yok', () => {
  assert.equal(changePct(0, 500), null);
  assert.equal(changePct(200, 300), 50);
  assert.equal(changePct(200, 100), -50);
  assert.equal(changePct(200, 200), 0);
});

test('vsAverage son ayı ÖNCEKİLERİN ORTALAMASIYLA karşılaştırır', () => {
  // Tek bir önceki ay taban olsaydı, uçak bileti alınan ayın ertesinde her
  // şey "büyük düşüş" görünürdü.
  const r = vsAverage([ay('2026-07', 100), ay('2026-08', 1000), ay('2026-09', 200)], 'expense');
  assert.equal(r.average, 550);
  assert.equal(r.value, 200);
  assert.equal(r.pct, -64);
});

test('vsAverage: tek aylık pencerede karşılaştırma yok', () => {
  assert.equal(vsAverage([ay('2026-09', 100)]), null);
  assert.equal(vsAverage([]), null);
  // Önceki aylar boşsa taban 0 → null, uydurma yüzde değil.
  assert.equal(vsAverage([ay('2026-08'), ay('2026-09', 100)]), null);
});

test('kategori satırları pencerenin sırasını korur, eksik ay 0 olur', () => {
  const kat = [{ category_id: 'c1', name: 'Market', icon: '🛒', total: 300, by_month: { '2026-09': 300 } }];
  const [r] = categoryRows(kat, [ay('2026-07'), ay('2026-08'), ay('2026-09', 300)]);
  assert.deepEqual(r.series.map((x) => x.period), ['2026-07', '2026-08', '2026-09']);
  assert.deepEqual(r.series.map((x) => x.value), [0, 0, 300]);
  assert.equal(r.pct, 100);
});

test('yön oku %10 eşiğinin altında çıkmaz — gürültüye ok konmaz', () => {
  // Aylık toplamlar kategori toplamlarıyla tutarlı kurulur: gerçek veride
  // ikisi de aynı işlemlerden gelir.
  const mk = (b) => [{ category_id: 'c', name: 'X', icon: '🏷️', total: Object.values(b).reduce((s, v) => s + v, 0), by_month: b }];
  const yon = (b) => {
    const aylar = ['2026-07', '2026-08', '2026-09'].map((p) => ay(p, b[p] || 0));
    return categoryRows(mk(b), aylar)[0].direction;
  };
  assert.equal(yon({ '2026-07': 100, '2026-08': 100, '2026-09': 105 }), 'flat');
  assert.equal(yon({ '2026-07': 100, '2026-08': 100, '2026-09': 200 }), 'up');
  assert.equal(yon({ '2026-07': 100, '2026-08': 100, '2026-09': 50 }), 'down');
  // Önceki aylar boş → karşılaştırılamaz, ok yok.
  assert.equal(yon({ '2026-09': 500 }), null);
});

test('KART KENDİYLE ÇELİŞMEZ: ortalama ve ok aynı pencereden', () => {
  // Gerçek bir denemede çıktı: kart "5 aylık ortalama" derken altındaki ok,
  // içinde boş aylar olan bir tabana göre %397 artış gösteriyordu.
  const aylar = [ay('2026-04'), ay('2026-05'), ay('2026-06', 100), ay('2026-07', 100), ay('2026-08', 100), ay('2026-09', 200)];
  const st = trendStats(aylar);
  const vs = vsAverage(aylar, 'expense');
  assert.equal(st.months, 4);
  // Ok da yalnızca hareketli ayların ortalamasına bakar: (100+100+100)/3 = 100
  assert.equal(vs.average, 100);
  assert.equal(vs.pct, 100);
});

test('kategori yönü de boş başlangıç aylarını saymaz', () => {
  const aylar = [ay('2026-07'), ay('2026-08', 100), ay('2026-09', 110)];
  const kat = [{ category_id: 'c', name: 'X', icon: '🏷️', total: 210, by_month: { '2026-08': 100, '2026-09': 110 } }];
  // Boş temmuz sayılsaydı taban 50 olur, %120 artış diye yanlış bir ok çıkardı.
  assert.equal(categoryRows(kat, aylar)[0].average, 100);
  assert.equal(categoryRows(kat, aylar)[0].direction, 'flat');
});

test('DB numeric string gelirse de sayı gibi davranır', () => {
  // PostgREST numeric alanları string döndürebiliyor; "100" + "200" = "100200"
  // olmasın diye her değer sayıya çevriliyor.
  const st = trendStats([{ period: '2026-08', expense: '100', income: '0' }, { period: '2026-09', expense: '300', income: '0' }]);
  assert.equal(st.totalExpense, 400);
  assert.equal(st.avgExpense, 200);
});

test('isEmptyTrend: boş pencere ile dolu pencereyi ayırır', () => {
  assert.equal(isEmptyTrend({ months: [ay('2026-08'), ay('2026-09')] }), true);
  assert.equal(isEmptyTrend({ months: YENI_HANE }), false);
  assert.equal(isEmptyTrend({ months: [] }), true);
  assert.equal(isEmptyTrend(null), true);
  // Yalnızca geliri olan ay da doludur.
  assert.equal(isEmptyTrend({ months: [ay('2026-09', 0, 500)] }), false);
});
