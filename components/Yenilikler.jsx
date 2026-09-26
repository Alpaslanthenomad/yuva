'use client';
// components/Yenilikler.jsx — Bugün ekranında tek seferlik "Yenilikler" kartı.
// Her satır ilgili ekrana götürür; "Anladım" kartı bu sürüm için kapatır.
import { useEffect, useState } from 'react';
import { useT } from '../lib/i18n/context.jsx';
import { YENILIKLER, gorulduMu, gorulduYap } from '../lib/yenilikler.js';

export default function Yenilikler() {
  const t = useT();
  const [goster, setGoster] = useState(false);
  useEffect(() => { setGoster(!gorulduMu(window.localStorage)); }, []);
  if (!goster) return null;

  const kapat = () => { gorulduYap(window.localStorage); setGoster(false); };

  return (
    <section className="card yenilik" aria-label={t('whatsNew.title')}>
      <div className="between" style={{ marginBottom: 'var(--sp-2)' }}>
        <h2 className="h2">✨ {t('whatsNew.title')}</h2>
        <button type="button" className="btn btn--ghost btn--sm" aria-label={t('common.close')} onClick={kapat}>✕</button>
      </div>
      <div className="faint" style={{ marginBottom: 'var(--sp-2)' }}>{t('whatsNew.intro')}</div>
      <ul className="yenilik__liste">
        {YENILIKLER.map((y) => (
          <li key={y.key}>
            <a href={y.href} className="yenilik__satir">
              <span className="yenilik__emoji" aria-hidden="true">{y.emoji}</span>
              <span className="yenilik__metin">
                <b>{t(`whatsNew.items.${y.key}.title`)}</b>
                <span>{t(`whatsNew.items.${y.key}.body`)}</span>
              </span>
              <span className="faint" aria-hidden="true">›</span>
            </a>
          </li>
        ))}
      </ul>
      <button type="button" className="btn btn--block" onClick={kapat}>{t('whatsNew.gotIt')}</button>
    </section>
  );
}
