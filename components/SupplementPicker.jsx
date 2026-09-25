'use client';
import { useState } from 'react';
import { Chips } from './ui.jsx';
import { useT, useLocale } from '../lib/i18n/context.jsx';
import { SUPPLEMENT_GROUPS, SUPPLEMENT_CATALOG, supplementName } from '../lib/supplementCatalog.js';

/**
 * Takviye seçme ızgarası — alışveriş ızgarasının (ShoppingPicker) kardeşi.
 *
 * FARKI: burada dokunmak "bugün aldım" demek değil, "bunu her gün alıyorum"
 * demek. Yani listeye EKLER. Günlük işaretleme Bugün sekmesinde yapılıyor.
 * İkisini tek dokunuşa bindirmek, listeyi kurarken yanlışlıkla o günü de
 * işaretlemek demekti.
 *
 * Zaten listede olan kayıt sönük ve dokunulamaz görünüyor: aynı takviyeyi
 * iki kez eklemek sessizce iki satır yaratırdı.
 */
export default function SupplementPicker({ mevcut = [], onPick, busyKey }) {
  const t = useT();
  const { locale } = useLocale();
  const es = String(locale || '').startsWith('es');
  const [group, setGroup] = useState(SUPPLEMENT_GROUPS[0].key);

  const ekli = new Set(mevcut.map((s) => s.catalog_key).filter(Boolean));
  const rows = SUPPLEMENT_CATALOG.filter((x) => x.group === group);

  return (
    <div>
      <div className="faint" style={{ marginBottom: 'var(--sp-2)' }}>{t('gunum.supplementPickHint')}</div>
      <Chips value={group} onChange={setGroup}
        options={SUPPLEMENT_GROUPS.map((g) => ({ value: g.key, label: `${g.emoji} ${es ? g.es : g.tr}` }))} />
      <div className="picker">
        {rows.map((item) => {
          const var_ = ekli.has(item.key);
          return (
            <button key={item.key} type="button"
              className={'picker__item' + (var_ ? ' picker__item--done' : '')}
              disabled={var_ || busyKey === item.key} aria-pressed={var_}
              onClick={() => onPick(item)}>
              <span className="picker__emoji" aria-hidden="true">{item.emoji}</span>
              <span className="picker__name">{supplementName(item, locale)}</span>
              {var_ && <span className="picker__tick" aria-hidden="true">✓</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
