'use client';
// components/ThemeSwitch.jsx — Açık / Koyu / Sistem seçici.
import { useEffect, useState } from 'react';
import { useT } from '../lib/i18n/context.jsx';
import { THEMES, readStoredTheme, storeTheme, systemPrefersDark, resolveTheme, applyTheme } from '../lib/theme.js';

export default function ThemeSwitch() {
  const t = useT();
  // Statik export: ilk render sunucuda, orada tercih bilinmez. Gerçek değer
  // mount sonrası okunuyor; renkleri zaten <head> betiği çoktan uyguladı.
  const [pref, setPref] = useState('system');
  useEffect(() => { setPref(readStoredTheme()); }, []);

  const sec = (p) => {
    setPref(p);
    storeTheme(p);
    applyTheme(resolveTheme(p, systemPrefersDark()));
  };

  return (
    <div className="chips">
      {THEMES.map((p) => (
        <button key={p} type="button" aria-pressed={p === pref}
          className={'chip' + (p === pref ? ' chip--active' : '')}
          onClick={() => sec(p)}>
          {t('settings.theme_' + p)}
        </button>
      ))}
    </div>
  );
}
