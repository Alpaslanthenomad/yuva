// lib/holidays.js — 🇨🇱 Şili + 🇹🇷 Türkiye resmi tatilleri (yıl bazlı üretim).
// Tatil adları anahtar olarak tutulur; metin lib/i18n sözlüklerinden gelir (TR/ES).
// Dini/ay takvimli günler tablo ile verilir; her yıl doğrulanmalı (TASK_BOARD: yıllık kontrol).
import { toISODate, fromISODate, addDays } from './dates.js';
import { translate, getLocale } from './i18n/index.js';

/** Paskalya Pazarı (Gregoryen, Meeus/Jones/Butcher) */
export function easterSunday(year) {
  const a = year % 19, b = Math.floor(year / 100), c = year % 100;
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return toISODate(new Date(year, month - 1, day));
}

/** Şili "lunes" kuralı: Salı–Perşembe'ye düşen tatil önceki Pazartesi'ye, Cuma'ya düşen sonraki Pazartesi'ye */
function toMondayCL(iso) {
  const dow = fromISODate(iso).getDay(); // 0=Paz
  if (dow === 2) return addDays(iso, -1);
  if (dow === 3) return addDays(iso, -2);
  if (dow === 4) return addDays(iso, -3);
  if (dow === 5) return addDays(iso, 3);
  return iso;
}

export function holidaysCL(year) {
  const e = easterSunday(year);
  const y = (m, d) => `${year}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  return [
    { date: y(1, 1), key: 'cl_newyear' },
    { date: addDays(e, -2), key: 'cl_goodfriday' },
    { date: addDays(e, -1), key: 'cl_holysaturday' },
    { date: y(5, 1), key: 'cl_labour' },
    { date: y(5, 21), key: 'cl_navales' },
    { date: y(6, 21), key: 'cl_indigenous' },
    { date: toMondayCL(y(6, 29)), key: 'cl_pedropablo' },
    { date: y(7, 16), key: 'cl_carmen' },
    { date: y(8, 15), key: 'cl_asuncion' },
    { date: y(9, 18), key: 'cl_patrias' },
    { date: y(9, 19), key: 'cl_ejercito' },
    { date: toMondayCL(y(10, 12)), key: 'cl_dosmundos' },
    { date: y(10, 31), key: 'cl_evangelicas' },
    { date: y(11, 1), key: 'cl_santos' },
    { date: y(12, 8), key: 'cl_inmaculada' },
    { date: y(12, 25), key: 'cl_navidad' },
  ].map((h) => ({ ...h, country: 'CL' }));
}

// Dini bayramlar (Diyanet takvimi ile her yıl doğrulanmalı). Arife yarım günü dahil değil.
const TR_RELIGIOUS = {
  2026: { ramazan: ['2026-03-20', '2026-03-21', '2026-03-22'], kurban: ['2026-05-27', '2026-05-28', '2026-05-29', '2026-05-30'] },
  2027: { ramazan: ['2027-03-09', '2027-03-10', '2027-03-11'], kurban: ['2027-05-16', '2027-05-17', '2027-05-18', '2027-05-19'] },
  2028: { ramazan: ['2028-02-26', '2028-02-27', '2028-02-28'], kurban: ['2028-05-05', '2028-05-06', '2028-05-07', '2028-05-08'] },
};

export function holidaysTR(year) {
  const y = (m, d) => `${year}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  const base = [
    { date: y(1, 1), key: 'tr_newyear' },
    { date: y(4, 23), key: 'tr_cocuk' },
    { date: y(5, 1), key: 'tr_emek' },
    { date: y(5, 19), key: 'tr_genclik' },
    { date: y(7, 15), key: 'tr_demokrasi' },
    { date: y(8, 30), key: 'tr_zafer' },
    { date: y(10, 29), key: 'tr_cumhuriyet' },
  ];
  const r = TR_RELIGIOUS[year];
  if (r) {
    r.ramazan.forEach((d, i) => base.push({ date: d, key: 'tr_ramazan', n: i + 1 }));
    r.kurban.forEach((d, i) => base.push({ date: d, key: 'tr_kurban', n: i + 1 }));
  }
  return base.map((h) => ({ ...h, country: 'TR' })).sort((a, b) => a.date.localeCompare(b.date));
}

/** Tatil adını geçerli (ya da verilen) dilde çözer. */
export function holidayName(h, locale) {
  return translate(locale || getLocale(), 'holidays.' + h.key, h.n);
}

/**
 * countries: ['CL','TR'] → { 'YYYY-MM-DD': [{ key, name, country }] }
 * `name` çağrı anındaki dile göre çözülür.
 */
export function holidayMap(year, countries = ['CL', 'TR'], locale) {
  const all = [];
  if (countries.includes('CL')) all.push(...holidaysCL(year));
  if (countries.includes('TR')) all.push(...holidaysTR(year));
  const map = {};
  for (const h of all) (map[h.date] ||= []).push({ ...h, name: holidayName(h, locale) });
  return map;
}
