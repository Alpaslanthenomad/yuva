// lib/theme.js — açık/koyu kip.
//
// NEDEN VAR: uygulama yalnızca cihazın ayarını takip ediyordu. Telefonu koyu
// kipte olan biri uygulamayı açık kipte göremiyordu; görebilmek için telefonun
// TAMAMINI açık kipe almak gerekiyordu. Uygulamanın kendi tercihi olmalı.
//
// SEÇİM `<html data-theme="light|dark">` olarak yazılır; renkler tokens.css'te
// bu niteliğe bağlı. 'system' saklanır ama yazılmaz — çözülüp yazılır, çünkü
// CSS "sistemi takip et"i bir nitelik değeri olarak bilmez.

export const THEMES = ['system', 'light', 'dark'];
export const STORAGE_KEY = 'yuva:theme';

/** Tarayıcı çubuğu rengi: açıkta marka yeşili, koyuda arka plan. */
export const THEME_COLOR = { light: '#2F6F5E', dark: '#121311' };

/**
 * Tercih + sistemin durumu → uygulanacak kip.
 * Bilinmeyen/bozuk tercih 'system' sayılır: eski bir kayıt ya da elle
 * kurcalanmış bir değer yüzünden uygulama okunmaz hale gelmesin.
 *
 * @param {string|null} pref 'system' | 'light' | 'dark'
 * @param {boolean} systemDark cihaz koyu kipte mi
 * @returns {'light'|'dark'}
 */
export function resolveTheme(pref, systemDark = false) {
  if (pref === 'light' || pref === 'dark') return pref;
  return systemDark ? 'dark' : 'light';
}

/** Kayıtlı tercih; yoksa 'system'. Özel kipte localStorage patlayabilir. */
export function readStoredTheme() {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return THEMES.includes(v) ? v : 'system';
  } catch { return 'system'; }
}

export function storeTheme(pref) {
  try { localStorage.setItem(STORAGE_KEY, THEMES.includes(pref) ? pref : 'system'); } catch { /* özel mod */ }
}

export function systemPrefersDark() {
  try { return window.matchMedia('(prefers-color-scheme: dark)').matches; } catch { return false; }
}

/** Çözülmüş kipi belgeye uygula. Tarayıcı çubuğu da beraber döner. */
export function applyTheme(resolved) {
  if (typeof document === 'undefined') return;
  document.documentElement.dataset.theme = resolved;
  // `color-scheme` olmadan form öğeleri ve kaydırma çubukları eski kipte kalıyor.
  document.documentElement.style.colorScheme = resolved;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', THEME_COLOR[resolved] || THEME_COLOR.light);
}
