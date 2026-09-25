'use client';
// components/MoneyReport.jsx — Para › Rapor sekmesi.
//
// Hesap yok, çizim var: bütün sayılar month_trend'den (0020) geliyor, oranlar
// lib/report.js'ten. Burada yalnızca hangi çubuğun ne kadar uzun olacağı var.
//
// Değerler eksende yazmıyor, dokunulan ayın değerleri üstte açılıyor. 390 px
// genişlikte on iki çubuğun altına para tutarı sığmıyor; sığdırmaya çalışmak
// ya rakamı kesiyor ya yazıyı okunmaz küçültüyordu.
import { useState, useEffect } from 'react';
import { Card, Row, Empty, Seg } from './ui.jsx';
import { useT } from '../lib/i18n/context.jsx';
import { fmtPeriod, fmtPeriodShort } from '../lib/dates.js';
import { formatMoney } from '../lib/money.js';
import { trendSeries, trendStats, vsAverage, categoryRows, isEmptyTrend } from '../lib/report.js';

const RANGES = [3, 6, 12];

export default function MoneyReport({ trend, baseCurrency, range, onRange }) {
  const t = useT();
  const months = trend?.months || [];
  const [sel, setSel] = useState(null);

  // Pencere değişince seçim son aya döner: eski seçim artık başka bir ayı
  // gösteriyor olabilirdi.
  useEffect(() => { setSel(null); }, [trend]);

  const segment = (
    <Seg value={String(range)} onChange={(v) => onRange(Number(v))}
      options={RANGES.map((r) => ({ value: String(r), label: t('money.range' + r) }))} />
  );

  if (isEmptyTrend(trend)) {
    return (
      <>
        {segment}
        <div className="spacer" />
        <Card><Empty>{t('money.trendEmpty')}</Empty></Card>
      </>
    );
  }

  const gider = trendSeries(months, 'expense');
  const gelir = trendSeries(months, 'income');
  // İki çubuk aynı ölçeği paylaşmalı, yoksa 900.000'lik gelir ile 7.000'lik
  // gider aynı boyda görünür ve grafik yalan söyler.
  const tepe = Math.max(...gider.map((x) => x.value), ...gelir.map((x) => x.value), 0) || 1;

  const stats = trendStats(months);
  const vs = vsAverage(months, 'expense');
  const rows = categoryRows(trend?.categories, months);
  // Eksen etiketi: 12 aylık pencerede sütun ~26 px kalıyor ve "Oca 27" oraya
  // sığmayıp kesiliyor — üstelik kesilen tam da yıl sınırını gösteren etiket.
  // Uzun pencerede yıl düşüyor; yıl zaten seçili ayın başlığında tam yazıyor.
  const eksen = (p) => (months.length <= 6 ? fmtPeriodShort(p) : fmtPeriodShort(p).split(' ')[0]);
  const i = sel === null ? months.length - 1 : sel;
  const secili = months[i];

  return (
    <>
      {segment}
      <div className="spacer" />

      <Card title={fmtPeriod(secili?.period || '')}>
        <div className="stats" style={{ marginBottom: 'var(--sp-3)' }}>
          <div className="stat">
            <div className="stat__label">{t('money.income')}</div>
            <div className="stat__value money--income">{formatMoney(secili?.income || 0, baseCurrency, { compact: true })}</div>
          </div>
          <div className="stat">
            <div className="stat__label">{t('money.expense')}</div>
            <div className="stat__value money--expense">{formatMoney(secili?.expense || 0, baseCurrency, { compact: true })}</div>
          </div>
          <div className="stat">
            <div className="stat__label">{t('money.net')}</div>
            <div className="stat__value">{formatMoney(secili?.net || 0, baseCurrency, { compact: true })}</div>
          </div>
        </div>

        <div className="chart">
          {months.map((m, idx) => (
            <button key={m.period} type="button"
              className={'chart__col' + (idx === i ? ' chart__col--active' : '')}
              onClick={() => setSel(idx)} aria-label={fmtPeriod(m.period)}>
              <div className="chart__bars">
                <div className="chart__bar chart__bar--income"
                  style={{ height: `${((Number(m.income) || 0) / tepe) * 100}%` }} />
                <div className="chart__bar"
                  style={{ height: `${((Number(m.expense) || 0) / tepe) * 100}%` }} />
              </div>
              {/* 12 ay 390 px'e sığmıyor: etiketler kesilip okunmaz hale
                  geliyordu. Uzun pencerede bir atlayarak yazılıyor, son ay
                  her zaman yazılıyor — bakan kişi nerede bittiğini bilmeli. */}
              <div className="chart__label">
                {months.length <= 6 || idx === months.length - 1 || (months.length - 1 - idx) % 2 === 0
                  ? eksen(m.period) : ''}
              </div>
            </button>
          ))}
        </div>
        <div className="chart-legend">
          <span><i className="chart-legend__dot" style={{ background: 'var(--color-income)' }} />{t('money.income')}</span>
          <span><i className="chart-legend__dot" style={{ background: 'var(--color-expense)' }} />{t('money.expense')}</span>
        </div>
      </Card>

      <Card title={t('money.avgMonthly')}>
        <Row title={t('money.expense')} sub={t('money.avgSince', stats.months)}
          end={<span className="money money--expense">{formatMoney(stats.avgExpense, baseCurrency, { compact: true })}</span>} />
        <Row title={t('money.income')} sub={t('money.avgSince', stats.months)}
          end={<span className="money money--income">{formatMoney(stats.avgIncome, baseCurrency, { compact: true })}</span>} />
        {vs && (
          <div className="faint" style={{ marginTop: 'var(--sp-2)' }}>
            <span className={vs.pct > 0 ? 'trend-up' : vs.pct < 0 ? 'trend-down' : ''}>
              {vs.pct > 0 ? '▲' : vs.pct < 0 ? '▼' : '='} {t('common.pct', Math.abs(vs.pct))}
            </span>{' '}{t('money.vsAvg')}
          </div>
        )}
        {stats.months < months.length && stats.months > 0 && (
          <div className="faint" style={{ marginTop: 'var(--sp-1)' }}>{t('money.trendPartial', stats.months)}</div>
        )}
      </Card>

      <Card title={t('money.topCategories')}>
        {rows.map((c) => {
          const tepeKat = Math.max(...c.series.map((x) => x.value), 0) || 1;
          return (
            <Row key={c.id} icon={c.icon} title={c.name}
              sub={c.changePct === null ? undefined : `${c.direction === 'up' ? '▲' : c.direction === 'down' ? '▼' : '='} ${t('common.pct', Math.abs(c.changePct))}`}
              end={<span className="money">{formatMoney(c.total, baseCurrency, { compact: true })}</span>}>
              <div className="spark" aria-hidden="true">
                {c.series.map((x, idx) => (
                  <div key={x.period}
                    className={'spark__bar' + (idx === c.series.length - 1 ? ' spark__bar--last' : '')}
                    style={{ height: `${(x.value / tepeKat) * 100}%` }} />
                ))}
              </div>
            </Row>
          );
        })}
        {rows.length === 0 && <Empty>{t('common.empty')}</Empty>}
      </Card>
    </>
  );
}
