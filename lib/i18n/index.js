// lib/i18n/index.js — dil kayıt defteri ve çeviri motoru.
// React tarafı için context.jsx'teki useT() kullanılır; buradaki t() React dışı çağrılar içindir.
import tr from './tr.js';
import es from './es.js';
import { setDateLocale } from '../dates.js';

export const LOCALES = {
  tr: { code: 'tr', label: 'Türkçe', flag: '🇹🇷', intl: 'tr-TR' },
  es: { code: 'es', label: 'Español', flag: '🇨🇱', intl: 'es-CL' },
};
export const LOCALE_CODES = Object.keys(LOCALES);
export const DEFAULT_LOCALE = 'tr';

const DICTS = { tr, es };
export { DICTS };

/** 'es-CL' | 'ES' | 'es' → 'es' ; tanınmayan → null */
export function normalizeLocale(x) {
  if (!x) return null;
  const s = String(x).toLowerCase().slice(0, 2);
  return LOCALE_CODES.includes(s) ? s : null;
}

function lookup(dict, path) {
  return path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), dict);
}

/** Eksik anahtar varsayılan dile düşer; o da yoksa anahtarın kendisi döner. */
export function translate(locale, path, ...args) {
  let v = lookup(DICTS[locale] || DICTS[DEFAULT_LOCALE], path);
  if (v === undefined && locale !== DEFAULT_LOCALE) v = lookup(DICTS[DEFAULT_LOCALE], path);
  if (typeof v === 'function') return v(...args);
  return v === undefined ? path : v;
}

/** Bir dile bağlı t() üretir. `t.locale` ile hangi dilde olduğu okunabilir. */
export function makeT(locale) {
  const code = normalizeLocale(locale) || DEFAULT_LOCALE;
  const fn = (path, ...args) => translate(code, path, ...args);
  fn.locale = code;
  fn.intl = LOCALES[code].intl;
  return fn;
}

// ---- Cihaz tercihi (React dışından da okunabilir) ----
export const STORAGE_KEY = 'yuva:locale';

export function readStoredLocale() {
  if (typeof window === 'undefined') return null;
  try { return normalizeLocale(localStorage.getItem(STORAGE_KEY)); } catch { return null; }
}

/** Öncelik: cihaz seçimi → hane varsayılanı → tarayıcı dili → tr */
export function detectLocale(householdLocale) {
  return readStoredLocale()
    || normalizeLocale(householdLocale)
    || (typeof navigator !== 'undefined' ? normalizeLocale(navigator.language) : null)
    || DEFAULT_LOCALE;
}

// ---- React dışı modüller (dates, holidays, demoRepo) için geçerli dil ----
let current = DEFAULT_LOCALE;
export function getLocale() { return current; }
/** Provider render sırasında çağırır: modül düzeyindeki dili senkronlar. */
export function applyLocale(l) {
  current = normalizeLocale(l) || DEFAULT_LOCALE;
  setDateLocale(current);
  return current;
}
export const t = (path, ...args) => translate(current, path, ...args);
