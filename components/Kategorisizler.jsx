'use client';
// components/Kategorisizler.jsx — Bütçe → Özet: kategorisiz harcamalar (öneri 2).
//
// Kategorisiz harcama raporu ve limitleri sessizce bozuyor ("Diğer" gibi
// görünmüyor, hiçbir limite girmiyor). Bu kart o ayın kategorisizlerini
// sayar; açınca her birine tek dokunuşla kategori verilir. Öneri sırası:
// o mağaza için öğrenilmiş kategori (0035), sonra bu ay en çok kullanılanlar.
// Kategori verildikçe öğrenme de kendiliğinden güçlenir.
import { useEffect, useState } from 'react';
import { useApp } from './AppShell.jsx';
import { Card, Row, Money } from './ui.jsx';
import { useT } from '../lib/i18n/context.jsx';
import { fmtDay } from '../lib/dates.js';
import { magazaBul } from '../lib/hizliGiris.js';
import { katalogdanBul, presetCategoryId } from '../lib/expenseCatalog.js';

export default function Kategorisizler({ txns }) {
  const { repo, bump, categories, categoryById } = useApp();
  const t = useT();
  const [acik, setAcik] = useState(false);
  const [ogrenilen, setOgrenilen] = useState([]);
  const [busy, setBusy] = useState(null);
  const [digerAcik, setDigerAcik] = useState(null);

  const liste = (txns || []).filter((x) => x.kind === 'expense' && !x.category_id && !x.masked);
  useEffect(() => {
    if (!acik || !repo.suggest?.merchants) return;
    repo.suggest.merchants().then((r) => setOgrenilen(Array.isArray(r) ? r : [])).catch(() => {});
  }, [acik, repo]);

  if (liste.length === 0) return null;

  // Bu ay en çok kullanılan üst kategoriler — hızlı seçim çipleri.
  const sayac = new Map();
  for (const x of txns || []) {
    if (x.kind !== 'expense' || !x.category_id) continue;
    const c = categoryById(x.category_id); const ust = c?.parent_id || c?.id;
    if (ust) sayac.set(ust, (sayac.get(ust) || 0) + 1);
  }
  const ustler = categories.filter((c) => c.kind === 'expense' && !c.parent_id);
  const sik = [...ustler].sort((a, b) => (sayac.get(b.id) || 0) - (sayac.get(a.id) || 0)).slice(0, 6);
  const gider = categories.filter((c) => c.kind === 'expense');

  const ver = async (x, catId) => {
    if (!catId) return;
    setBusy(x.id);
    try { await repo.transactions.update(x.id, { category_id: catId }); bump(); }
    finally { setBusy(null); setDigerAcik(null); }
  };

  return (
    <Card className="kategorisiz">
      <button type="button" className="kategorisiz__baslik" onClick={() => setAcik((v) => !v)} aria-expanded={acik}>
        <span>🏷️ <b>{t('money.uncategorized', liste.length)}</b></span>
        <span className="faint">{acik ? '▲' : t('money.uncategorizedFix')}</span>
      </button>
      {acik && (
        <>
          <div className="faint" style={{ margin: 'var(--sp-2) 0' }}>{t('money.uncategorizedHint')}</div>
          {liste.map((x) => {
            const ogr = magazaBul(ogrenilen, x.merchant);
            const kat = !ogr && katalogdanBul(x.merchant);
            const oneri = (ogr && categoryById(ogr.category_id)) || (kat && categoryById(presetCategoryId(kat, categories))) || null;
            const cipler = [oneri, ...sik.filter((c) => c.id !== oneri?.id)].filter(Boolean).slice(0, 6);
            return (
              <Row key={x.id} icon="🧾" title={x.merchant || t('money.expense')} sub={fmtDay(x.occurred_on)}
                end={<Money amount={x.amount} currency={x.currency} kind="expense" />}>
                <div className="chips" style={{ marginTop: 'var(--sp-2)' }}>
                  {cipler.map((c, i) => (
                    <button key={c.id} type="button" disabled={busy === x.id}
                      className={'chip' + (i === 0 && oneri ? ' chip--active' : '')} onClick={() => ver(x, c.id)}>
                      {c.icon} {c.name}
                    </button>
                  ))}
                  {digerAcik === x.id ? (
                    <select className="select" style={{ width: 'auto' }} defaultValue="" onChange={(e) => ver(x, e.target.value)}>
                      <option value="">—</option>
                      {gider.map((c) => <option key={c.id} value={c.id}>{c.parent_id ? '↳ ' : ''}{c.icon} {c.name}</option>)}
                    </select>
                  ) : (
                    <button type="button" className="chip" onClick={() => setDigerAcik(x.id)}>… {t('money.otherCategory')}</button>
                  )}
                </div>
              </Row>
            );
          })}
        </>
      )}
    </Card>
  );
}
