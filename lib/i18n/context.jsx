'use client';
// lib/i18n/context.jsx — dil sağlayıcı. Bileşenler `const t = useT()` ile kullanır.
// Dil değişince context değeri değişir → t() çağıran her bileşen yeniden render olur.
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { applyLocale, makeT, normalizeLocale, readStoredLocale, detectLocale, STORAGE_KEY as KEY, DEFAULT_LOCALE, LOCALES } from './index.js';

const LocaleCtx = createContext(null);
export { readStoredLocale, detectLocale };

export function LocaleProvider({ children }) {
  // Statik export: ilk render her zaman varsayılan dille olur, cihaz tercihi mount sonrası uygulanır.
  const [locale, setLocaleState] = useState(DEFAULT_LOCALE);

  useEffect(() => {
    const l = detectLocale();
    setLocaleState((cur) => (l === cur ? cur : l));
  }, []);

  useEffect(() => {
    if (typeof document !== 'undefined') document.documentElement.lang = locale;
  }, [locale]);

  const setLocale = useCallback((l) => {
    const n = normalizeLocale(l) || DEFAULT_LOCALE;
    try { localStorage.setItem(KEY, n); } catch { /* özel mod */ }
    setLocaleState(n);
  }, []);

  /** Hane dilini yalnızca cihazda kayıtlı bir tercih YOKSA uygular. */
  const applyHouseholdDefault = useCallback((hl) => {
    if (readStoredLocale()) return;
    const n = normalizeLocale(hl);
    if (n) setLocaleState((cur) => (n === cur ? cur : n));
  }, []);

  const value = useMemo(() => {
    applyLocale(locale); // dates.js ve React dışı t() için senkron
    return { locale, setLocale, applyHouseholdDefault, t: makeT(locale), locales: LOCALES };
  }, [locale, setLocale, applyHouseholdDefault]);

  return <LocaleCtx.Provider value={value}>{children}</LocaleCtx.Provider>;
}

const FALLBACK = { locale: DEFAULT_LOCALE, setLocale() {}, applyHouseholdDefault() {}, t: makeT(DEFAULT_LOCALE), locales: LOCALES };
export function useLocale() { return useContext(LocaleCtx) ?? FALLBACK; }
export function useT() { return useLocale().t; }

/** Yeniden kullanılabilir dil seçici. */
export function LanguageSwitch({ block }) {
  const { locale, setLocale, locales } = useLocale();
  return (
    <div className={block ? 'chips' : 'seg'} style={block ? undefined : { display: 'inline-flex' }}>
      {Object.values(locales).map((l) => (
        <button
          key={l.code}
          type="button"
          className={block
            ? 'chip' + (l.code === locale ? ' chip--active' : '')
            : 'seg__btn' + (l.code === locale ? ' seg__btn--active' : '')}
          aria-pressed={l.code === locale}
          onClick={() => setLocale(l.code)}
        >
          {l.flag} {l.label}
        </button>
      ))}
    </div>
  );
}
