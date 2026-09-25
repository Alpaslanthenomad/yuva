// lib/report.js — Para raporunun saf hesapları.
//
// Veri veritabanından geliyor (month_trend, 0020). Burada yalnızca ÇİZİM için
// gereken dönüşümler var: oran, ortalama, yön. Tutar toplama yok — toplama
// veritabanının işi (ARCHITECTURE §3).
//
// Ayrı dosya olmasının sebebi: bir çubuk grafiğin yalan söylemesi çok kolay.
// Sıfıra bölme, boş ay, tek dolu ay… Hepsi ekranda makul görünen yanlış bir
// resim üretir. Bu yüzden kurallar testli tek bir yerde duruyor.

/** Boş/eksik sayıları 0'a indirger. DB numeric'i string döndürebiliyor. */
const n = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

/**
 * Pencerenin BAŞINDAKİ hareketsiz ayları atar.
 *
 * Bu kesim bir yerde değil her yerde geçerli olmalı: ortalama bir pencereden,
 * "ortalamaya göre" oku başka bir pencereden hesaplanırsa kart kendi kendisiyle
 * çelişir. Gerçek bir denemede tam bu oldu — kart "5 aylık ortalama" yazarken
 * altındaki ok, içinde iki boş ay olan bir tabana göre %397 artış gösteriyordu.
 *
 * Baştaki boşluk "henüz yoktuk", aradaki boşluk "o ay harcamadık" demek;
 * ikincisi gerçek bir sıfırdır ve kalır.
 */
export function activeMonths(months = []) {
  const list = months || [];
  const ilk = list.findIndex((m) => n(m?.expense) !== 0 || n(m?.income) !== 0);
  return ilk < 0 ? [] : list.slice(ilk);
}

/**
 * Bir alanın aylık dizisi, en yüksek değere göre yüzdelenmiş.
 * Yüzde ÇİZİM içindir; okunacak sayı her zaman `value`.
 *
 * Tepe değer 0 ise bütün yüzdeler 0 olur (sıfıra bölme yok) — yani boş bir
 * pencerede grafik düz kalır, tek bir ay tavana yapışmaz.
 *
 * @param {Object[]} months month_trend'in `months` dizisi
 * @param {string} key 'expense' | 'income' | 'net' | 'fixed' | 'variable'
 * @returns {{period:string, value:number, pct:number}[]}
 */
export function trendSeries(months = [], key = 'expense') {
  const rows = (months || []).map((m) => ({ period: m?.period || '', value: n(m?.[key]) }));
  // Net eksi olabilir; ölçek mutlak değere göre kurulur, yoksa eksi aylar
  // görünmez olur.
  const top = rows.reduce((mx, r) => Math.max(mx, Math.abs(r.value)), 0);
  return rows.map((r) => ({ ...r, pct: top > 0 ? (Math.abs(r.value) / top) * 100 : 0 }));
}

/**
 * Pencerenin ORTALAMASI — ama ilk hareketten itibaren.
 *
 * NEDEN: hane iki ay önce kurulduysa pencerenin başındaki dört boş ay gerçek
 * bir sıfır değil, "henüz yoktuk" demektir. Onları da sayarsak "aylık ortalama
 * gideriniz" yarı yarıya düşük çıkar ve bütçe konuşması yanlış sayının
 * üzerine kurulur. Aradaki boş ay ise gerçektir ve sayılır: o ay gerçekten
 * harcama olmamıştır.
 *
 * @param {Object[]} months
 * @returns {{months:number, avgExpense:number, avgIncome:number, totalExpense:number, totalIncome:number, net:number}}
 */
export function trendStats(months = []) {
  const dilim = activeMonths(months);
  const totalExpense = dilim.reduce((s, m) => s + n(m.expense), 0);
  const totalIncome = dilim.reduce((s, m) => s + n(m.income), 0);
  const k = dilim.length;
  return {
    months: k,
    totalExpense,
    totalIncome,
    net: totalIncome - totalExpense,
    avgExpense: k ? totalExpense / k : 0,
    avgIncome: k ? totalIncome / k : 0,
  };
}

/**
 * Yüzde değişim. Taban 0 ise null döner — "%∞ arttı" diye bir şey yok ve
 * ekranda sayı yerine çizgi göstermek dürüst olan.
 */
export function changePct(from, to) {
  const a = n(from);
  if (a === 0) return null;
  return Math.round(((n(to) - a) / Math.abs(a)) * 100);
}

/**
 * Son ay, kendinden önceki ayların ortalamasına göre nerede?
 * Tek aylık pencerede karşılaştıracak bir şey yok → null.
 *
 * Son ay ile bir önceki ayı değil, ÖNCEKİLERİN ORTALAMASINI karşılaştırıyor:
 * tek bir ay (uçak bileti alınan ay) karşılaştırma tabanı olursa her ay
 * "büyük düşüş" görünür.
 */
export function vsAverage(months = [], key = 'expense') {
  // Ortalama kartıyla AYNI pencere: yoksa kart kendi kendisiyle çelişir.
  const list = activeMonths(months);
  if (list.length < 2) return null;
  const son = n(list[list.length - 1]?.[key]);
  const onceki = list.slice(0, -1);
  const ort = onceki.reduce((s, m) => s + n(m?.[key]), 0) / onceki.length;
  const pct = changePct(ort, son);
  return pct === null ? null : { value: son, average: ort, pct };
}

/**
 * Kategori satırları: pencere toplamı + aylık seri + son ayın yönü.
 * `direction`: 'up' | 'down' | 'flat' | null (karşılaştırılamıyor).
 *
 * Eşik %10: altındaki oynamalar gürültü. Her %1 için ok göstermek, bakan
 * kişiyi olmayan bir eğilimi kovalamaya iter.
 *
 * @param {Object[]} categories month_trend'in `categories` dizisi
 * @param {Object[]} months pencerenin ayları (sıra buradan gelir)
 */
export function categoryRows(categories = [], months = []) {
  // Seri tüm pencereyi çizer (grafik kısalmasın), ama YÖN yalnızca hane
  // hareketlenmiş aylardan hesaplanır — ortalama kartıyla aynı taban.
  const donemler = (months || []).map((m) => m?.period).filter(Boolean);
  const aktif = new Set(activeMonths(months).map((m) => m?.period));
  const topTotal = (categories || []).reduce((mx, c) => Math.max(mx, n(c?.total)), 0);
  return (categories || []).map((c) => {
    const seri = donemler.map((p) => ({ period: p, value: n(c?.by_month?.[p]) }));
    const son = seri.length ? seri[seri.length - 1].value : 0;
    const onceki = seri.slice(0, -1).filter((x) => aktif.has(x.period));
    const ort = onceki.length ? onceki.reduce((s, x) => s + x.value, 0) / onceki.length : null;
    const pct = ort === null ? null : changePct(ort, son);
    return {
      id: c?.category_id || '',
      name: c?.name || '',
      icon: c?.icon || '🏷️',
      total: n(c?.total),
      pct: topTotal > 0 ? (n(c?.total) / topTotal) * 100 : 0,
      series: seri,
      last: son,
      average: ort,
      changePct: pct,
      direction: pct === null ? null : pct > 10 ? 'up' : pct < -10 ? 'down' : 'flat',
    };
  });
}

/** Pencerede hiç hareket var mı? Boş rapor yerine yönlendirme göstermek için. */
export function isEmptyTrend(trend) {
  const list = trend?.months || [];
  return !list.some((m) => n(m?.expense) !== 0 || n(m?.income) !== 0);
}
