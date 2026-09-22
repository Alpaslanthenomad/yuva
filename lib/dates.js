// lib/dates.js — tarih saf fonksiyonları. Yerel tarih 'YYYY-MM-DD' string olarak taşınır.
// Dil: setDateLocale() ile modül düzeyinde ayarlanır (LocaleProvider render sırasında çağırır).
// Böylece her çağrıya locale geçirmek gerekmez; test için fonksiyonlar `loc` parametresi de kabul eder.

const L = {
  tr: {
    dow: ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'],
    dowLong: ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'],
    months: ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'],
    day: (d, m) => `${d} ${m}`,
    dayLong: (dowLong, d, m) => `${dowLong}, ${d} ${m}`,
    period: (m, y) => `${m} ${y}`,
    today: 'Bugün', tomorrow: 'Yarın', yesterday: 'Dün',
    inDays: (n) => `${n} gün sonra`, agoDays: (n) => `${n} gün önce`,
  },
  es: {
    dow: ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'],
    dowLong: ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'],
    months: ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'],
    day: (d, m) => `${d} ${m}`,
    dayLong: (dowLong, d, m) => `${dowLong}, ${d} de ${m}`,
    period: (m, y) => `${m} ${y}`,
    today: 'Hoy', tomorrow: 'Mañana', yesterday: 'Ayer',
    inDays: (n) => `en ${n} días`, agoDays: (n) => `hace ${n} días`,
  },
};

let LOCALE = 'tr';
export function setDateLocale(l) { if (L[l]) LOCALE = l; }
export function getDateLocale() { return LOCALE; }
const S = (loc) => L[loc || LOCALE] || L.tr;

/** Kısa gün adları (Pzt…Paz / Lun…Dom) */
export function dowNames(loc) { return S(loc).dow; }
export function dowLongNames(loc) { return S(loc).dowLong; }
export function monthNames(loc) { return S(loc).months; }

export function pad(n) { return String(n).padStart(2, '0'); }

/** Date → 'YYYY-MM-DD' (yerel) */
export function toISODate(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
/** 'YYYY-MM-DD' → Date (yerel gece yarısı) */
export function fromISODate(s) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}
export function today() { return toISODate(new Date()); }
export function addDays(iso, n) { const d = fromISODate(iso); d.setDate(d.getDate() + n); return toISODate(d); }
export function addMonths(iso, n) { const d = fromISODate(iso); d.setMonth(d.getMonth() + n); return toISODate(d); }
export function periodOf(iso) { return iso.slice(0, 7); }
export function daysBetween(a, b) { return Math.round((fromISODate(b) - fromISODate(a)) / 86400000); }

/** ISO haftanın Pazartesi'si (weekStartsOn=1) */
export function startOfWeek(iso, weekStartsOn = 1) {
  const d = fromISODate(iso);
  const dow = (d.getDay() + 6) % 7; // Pzt=0
  const diff = (dow - (weekStartsOn === 1 ? 0 : 6) + 7) % 7;
  d.setDate(d.getDate() - diff);
  return toISODate(d);
}
export function weekDays(iso, weekStartsOn = 1) {
  const s = startOfWeek(iso, weekStartsOn);
  return Array.from({ length: 7 }, (_, i) => addDays(s, i));
}
/** Ay ızgarası: 6 hafta × 7 gün, dışarıdaki günler dahil */
export function monthGrid(period, weekStartsOn = 1) {
  const first = period + '-01';
  const start = startOfWeek(first, weekStartsOn);
  return Array.from({ length: 42 }, (_, i) => addDays(start, i));
}
export function dowIndex(iso) { return (fromISODate(iso).getDay() + 6) % 7; }

export function fmtDay(iso, loc) {
  const s = S(loc), d = fromISODate(iso);
  return s.day(d.getDate(), s.months[d.getMonth()]);
}
export function fmtDayLong(iso, loc) {
  const s = S(loc), d = fromISODate(iso);
  return s.dayLong(s.dowLong[dowIndex(iso)], d.getDate(), s.months[d.getMonth()]);
}
export function fmtPeriod(period, loc) {
  const s = S(loc), [y, m] = period.split('-').map(Number);
  return s.period(s.months[m - 1], y);
}
export function fmtTime(ts) {
  const d = new Date(ts);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
/** Göreli etiket: Bugün / Yarın / 3 gün sonra — Hoy / Mañana / en 3 días */
export function relativeLabel(iso, base = today(), loc) {
  const s = S(loc), n = daysBetween(base, iso);
  if (n === 0) return s.today;
  if (n === 1) return s.tomorrow;
  if (n === -1) return s.yesterday;
  return n > 1 ? s.inDays(n) : s.agoDays(-n);
}

/**
 * Basit RRULE açılımı. Destek: FREQ=DAILY|WEEKLY|MONTHLY|YEARLY, INTERVAL, BYDAY (haftalık), COUNT, UNTIL.
 * Dönüş: aralıktaki oluşum tarihleri ('YYYY-MM-DD'). Tam RFC5545 değildir; Faz 2'de rrule.js'e geçilebilir.
 */
export function expandRRule(rrule, startIso, rangeFrom, rangeTo, exdates = []) {
  if (!rrule) {
    return startIso >= rangeFrom && startIso <= rangeTo ? [startIso] : [];
  }
  const parts = Object.fromEntries(rrule.split(';').map((p) => p.split('=')));
  const freq = parts.FREQ || 'WEEKLY';
  const interval = Number(parts.INTERVAL || 1);
  const count = parts.COUNT ? Number(parts.COUNT) : Infinity;
  const until = parts.UNTIL ? parts.UNTIL.slice(0, 4) + '-' + parts.UNTIL.slice(4, 6) + '-' + parts.UNTIL.slice(6, 8) : null;
  const byday = parts.BYDAY ? parts.BYDAY.split(',') : null;
  const DOW = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'];
  const ex = new Set(exdates || []);
  const out = [];
  let produced = 0;
  let cursor = startIso;
  let guard = 0;
  const startDom = fromISODate(startIso).getDate();

  while (cursor <= rangeTo && produced < count && guard++ < 5000) {
    if (until && cursor > until) break;
    let hits = [];
    if (freq === 'WEEKLY' && byday) {
      const ws = startOfWeek(cursor);
      hits = byday.map((d) => addDays(ws, DOW.indexOf(d))).filter((d) => d >= startIso);
    } else {
      hits = [cursor];
    }
    for (const h of hits) {
      if (produced >= count) break;
      if (until && h > until) break;
      produced++;
      if (h >= rangeFrom && h <= rangeTo && !ex.has(h)) out.push(h);
    }
    if (freq === 'DAILY') cursor = addDays(cursor, interval);
    // BYDAY varsa imleç hafta başına sabitlenir (günler haftanın başından üretilir).
    // BYDAY yoksa olay kendi gününde tekrar eder; hafta başına çekilmemeli.
    else if (freq === 'WEEKLY') cursor = byday ? addDays(startOfWeek(cursor), 7 * interval) : addDays(cursor, 7 * interval);
    else if (freq === 'MONTHLY') {
      const d = fromISODate(cursor); d.setDate(1); d.setMonth(d.getMonth() + interval);
      const dim = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
      d.setDate(Math.min(startDom, dim)); cursor = toISODate(d);
    } else if (freq === 'YEARLY') {
      const d = fromISODate(cursor); d.setFullYear(d.getFullYear() + interval); cursor = toISODate(d);
    } else break;
  }
  return out;
}

/** Önemli gün → bu yıl / gelecek yıl tarihi ve kaç gün kaldığı */
export function nextOccasionDate(month, day, base = today()) {
  const b = fromISODate(base);
  let d = new Date(b.getFullYear(), month - 1, day);
  if (toISODate(d) < base) d = new Date(b.getFullYear() + 1, month - 1, day);
  const iso = toISODate(d);
  return { date: iso, daysLeft: daysBetween(base, iso) };
}

/** İki olay örtüşüyor mu? (timestamptz string'leri) */
export function overlaps(aStart, aEnd, bStart, bEnd) {
  const as = new Date(aStart).getTime(), ae = new Date(aEnd || aStart).getTime();
  const bs = new Date(bStart).getTime(), be = new Date(bEnd || bStart).getTime();
  return as < be && bs < ae;
}

/**
 * Tekrar kuralına göre verilen günden SONRAKİ ilk tarih.
 * Tekrarlayan görevlerde kullanılır: görev tamamlanınca `due_on` bir sonraki
 * tekrara taşınır. Seri, görevin mevcut vadesine sabitlenir — böylece bir kez
 * ertelenen görev bundan sonra ertelenen günden devam eder.
 * @param {string|null} rrule
 * @param {string} afterIso bu günden sonrası aranır (dahil değil)
 * @returns {string|null} sonraki tarih; kural yoksa veya iki yıl içinde tekrar
 *   yoksa null
 */
export function nextOccurrence(rrule, afterIso) {
  if (!rrule || !afterIso) return null;
  const hits = expandRRule(rrule, afterIso, addDays(afterIso, 1), addDays(afterIso, 730));
  return hits[0] || null;
}
