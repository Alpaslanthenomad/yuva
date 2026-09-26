'use client';
import { useEffect, useState } from 'react';
import DuzenliOdemeler from '../../components/DuzenliOdemeler.jsx';
import { useApp } from '../../components/AppShell.jsx';
import { Card, Row, Money, Bar, Chips, Seg, Empty, Sheet, Field } from '../../components/ui.jsx';
import { ExpenseForm } from '../../components/QuickAdd.jsx';
import MoneyReport from '../../components/MoneyReport.jsx';
import { useT } from '../../lib/i18n/context.jsx';
import { today, periodOf, addMonths, fmtPeriod, fmtDay, relativeLabel } from '../../lib/dates.js';
import { formatMoney, budgetState, dailyAllowance, parseAmount, minorToDecimal } from '../../lib/money.js';

// Altı sekme telefonda tek satıra sığmıyordu ("Dü…" kesiliyordu). Düzenli
// ödemeler Hesaplar sekmesinin altına taşındı; beş sekme eşit genişlikte.
const TABS = ['overview', 'transactions', 'report', 'budgets', 'accounts'];

export default function MoneyPage() {
  const { repo, household, baseCurrency, categoryById, memberById, accountById, categories, members, tick, bump } = useApp();
  const t = useT();
  const [tab, setTab] = useState('overview');
  // Bildirimden / Bugün ekranından gelinen sekme ve "Ödendi" onayı (0033):
  // /para/?sekme=accounts&ode=<düzenli ödeme>
  const [odeId, setOdeId] = useState(null);
  useEffect(() => {
    try {
      const q = new URLSearchParams(window.location.search);
      const s = q.get('sekme');
      if (s && ['overview', 'transactions', 'report', 'budgets', 'accounts'].includes(s)) setTab(s);
      if (q.get('ode')) setOdeId(q.get('ode'));
    } catch { /* adres okunamazsa varsayılan */ }
  }, []);
  const [period, setPeriod] = useState(periodOf(today()));
  const [d, setD] = useState(null);
  const [adding, setAdding] = useState(false);
  const [editTxn, setEditTxn] = useState(null);      // düzenlenen işlem
  const [fScope, setFScope] = useState('');          // filtre: aile / kişisel
  const [scope, setScope] = useState('family');      // rapor kapsamı (0027)
  const [limitAcik, setLimitAcik] = useState(false); // kişisel limit formu
  const [fCategory, setFCategory] = useState('');    // filtre: kategori
  const [fAccount, setFAccount] = useState('');      // filtre: hesap
  const [fKind, setFKind] = useState('');            // filtre: gelir/gider/transfer
  const [range, setRange] = useState(6);             // rapor penceresi (ay)
  const [trend, setTrend] = useState(null);

  useEffect(() => {
    if (!household) return;
    (async () => {
      const [month, prev, budget, txns, bills, balances] = await Promise.all([
        repo.summary.month(period), repo.summary.month(periodOf(addMonths(period + '-01', -1))),
        repo.summary.budgetStatus(period), repo.transactions.list({ period }), repo.recurring.list(), repo.accounts.balances(),
      ]);
      setD({ month, prev, budget, txns, bills, balances });
    })();
  }, [repo, household, period, tick]);

  useEffect(() => {
    if (!household || tab !== 'report') return;
    let iptal = false;
    setTrend(null);
    (async () => {
      const r = await repo.summary.trend(period, range, scope);
      if (!iptal) setTrend(r);
    })();
    return () => { iptal = true; };
  }, [repo, household, period, range, scope, tab, tick]);

  if (!d) return <Empty>{t('common.loading')}</Empty>;
  const { month, prev, budget, txns, bills, balances } = d;
  // Net, nakit akışının sorusu: gelirden AİLE + KİŞİSEL bütün giderler düşer.
  const net = month.income - (month.total_expense ?? month.expense);
  const delta = prev.expense > 0 ? Math.round(((month.expense - prev.expense) / prev.expense) * 100) : null;
  const total = budget.find((b) => b.category_id === null);
  const catTotal = month.by_category.reduce((s, c) => s + c.total, 0) || 1;
  const kisisel = month.personal || { total: 0, limit: null, by_category: [] };
  const buAy = period === periodOf(today());

  return (
    <>
      {/* Başlıkta ayrı "Harcama ekle" düğmesi yok: sağ alttaki + zaten aynı
          işi yapıyor. İki düğme, tek iş için iki yer demekti. */}
      <div className="page-head">
        <h1 className="h1">{t('money.title')}</h1>
      </div>
      <div className="cal-nav">
        <button type="button" className="btn btn--ghost btn--sm" onClick={() => setPeriod(periodOf(addMonths(period + '-01', -1)))} aria-label="‹">‹</button>
        <button type="button" className="cal-nav__label" onClick={() => setPeriod(periodOf(today()))}>{fmtPeriod(period)}</button>
        <button type="button" className="btn btn--ghost btn--sm" onClick={() => setPeriod(periodOf(addMonths(period + '-01', 1)))} aria-label="›">›</button>
      </div>
      <div className="seg-fit"><Seg value={tab} onChange={setTab} options={TABS.map((k) => ({ value: k, label: t('money.' + k) }))} /></div>
      <div className="spacer" />

      {/* ÖZET — üç soru, üç kart:
          1) Aile bu ay ne harcadı, limitin neresindeyiz?
          2) Aile parası nereye gitti? (kategori)
          3) Benim kişisel harcamam ve limitim.
          Üye dağılımı ve sabit/değişken kutuları kaldırıldı: harcamalar aile
          için yapılıyor; kişi ayrımını artık kişisel işareti taşıyor. */}
      {tab === 'overview' && (
        <>
          <Card className="butce-ozet">
            <div className="butce-ozet__etiket">{t('money.familySpend')}</div>
            <div className="butce-ozet__tutar">{formatMoney(month.expense, baseCurrency)}</div>
            {delta !== null && (
              <div className="faint">{delta > 0 ? '▲' : '▼'} {t('common.pct', Math.abs(delta))} {t('money.vsLastMonth')}</div>
            )}
            {total ? (
              <>
                <div style={{ margin: 'var(--sp-3) 0 var(--sp-1)' }}><Bar pct={total.pct} state={budgetState(total.spent, total.budget).state} /></div>
                <div className="between faint">
                  <span>{t('money.familyLimit')}: {formatMoney(total.budget, baseCurrency)}</span>
                  <span>{total.remaining >= 0 ? `${formatMoney(total.remaining, baseCurrency)} ${t('money.left')}` : `${formatMoney(-total.remaining, baseCurrency)} ${t('money.over')}`}</span>
                </div>
                {buAy && total.remaining > 0 && <div className="faint" style={{ marginTop: 2 }}>{t('money.leftPerDay', formatMoney(dailyAllowance(total.remaining), baseCurrency))}</div>}
              </>
            ) : (
              <button type="button" className="btn btn--ghost btn--sm" style={{ marginTop: 'var(--sp-2)', paddingLeft: 0 }} onClick={() => setTab('budgets')}>+ {t('money.setLimit')}</button>
            )}
            {month.income > 0 && (
              <div className="faint" style={{ marginTop: 'var(--sp-2)' }}>
                {t('money.incomeLine', formatMoney(month.income, baseCurrency, { compact: true }), formatMoney(net, baseCurrency, { compact: true }))}
              </div>
            )}
          </Card>

          <Card title={t('money.byCategory')}>
            {month.by_category.map((c) => (
              <Row key={c.category_id} icon={c.icon} title={c.name} end={<Money amount={c.total} currency={baseCurrency} />}>
                <div style={{ marginTop: 6 }}><Bar pct={(c.total / catTotal) * 100} /></div>
              </Row>
            ))}
            {month.by_category.length === 0 && <Empty>{t('common.empty')}</Empty>}
          </Card>

          <KisiselKart t={t} kisisel={kisisel} baseCurrency={baseCurrency} repo={repo} bump={bump}
            acik={limitAcik} setAcik={setLimitAcik} />
        </>
      )}

      {tab === 'transactions' && (() => {
        // Filtre yalnızca görüntüyü daraltır; toplamlar filtreye göre yeniden hesaplanır.
        const shown = txns.filter((x) =>
          (!fScope || (fScope === 'personal' ? Boolean(x.for_member_id) : !x.for_member_id || x.kind !== 'expense')) &&
          (!fCategory || x.category_id === fCategory || categoryById(x.category_id)?.parent_id === fCategory) &&
          // Transfer iki hesabı ilgilendirir; hesap filtresinde her ikisinde de görünmeli.
          (!fAccount || x.account_id === fAccount || x.transfer_account_id === fAccount) &&
          (!fKind || x.kind === fKind));
        const shownTotal = shown.filter((x) => x.kind === 'expense')
          .reduce((s, x) => s + Number(x.amount_base ?? x.amount), 0);
        return (
          <>
            <Chips value={fScope} onChange={setFScope} options={[
              { value: '', label: t('money.scopeAll') },
              { value: 'family', label: '👨‍👩‍👧 ' + t('money.family') },
              { value: 'personal', label: '👤 ' + t('money.personal') }]} />
            <div className="spacer" />
            <div className="grid-2" style={{ marginBottom: 'var(--sp-3)' }}>
              <Field label={t('money.category')}>
                <select className="select" value={fCategory} onChange={(e) => setFCategory(e.target.value)}>
                  <option value="">{t('common.any')}</option>
                  {categories.filter((c) => !c.parent_id).map((c) => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
                </select>
              </Field>
              <Field label={t('money.account')}>
                <select className="select" value={fAccount} onChange={(e) => setFAccount(e.target.value)}>
                  <option value="">{t('common.any')}</option>
                  {(balances || []).map((a) => <option key={a.account_id} value={a.account_id}>{a.icon} {a.name}</option>)}
                </select>
              </Field>
              <Field label={t('money.kindFilter')}>
                <select className="select" value={fKind} onChange={(e) => setFKind(e.target.value)}>
                  <option value="">{t('common.any')}</option>
                  <option value="expense">{t('money.expense')}</option>
                  <option value="income">{t('money.income')}</option>
                  <option value="transfer">{t('money.transfer')}</option>
                </select>
              </Field>
            </div>
            {/* Satırların düzenlenebildiğini söylemek gerekiyordu: kullanıcı
                yanlış girdiği bir harcamayı düzeltemediğini sandı. */}
            <div className="faint" style={{ marginBottom: 'var(--sp-2)' }}>{t('money.editHint')}</div>
            <Card>
              {shown.map((x) => {
                const c = categoryById(x.category_id);
                // Eşin kişisel harcaması: yalnızca tarih, hesap, kimin ve tutar (0029).
                if (x.masked) {
                  return (
                    <Row key={x.id} icon="🔒" title={t('money.personalMasked')}
                      sub={`${fmtDay(x.occurred_on)} · ${accountById(x.account_id)?.name || ''} · 👤 ${memberById(x.for_member_id)?.display_name || ''}`}
                      end={<div><Money amount={x.amount} currency={x.currency} kind={x.kind} />{x.currency !== baseCurrency && <div className="faint">≈ {formatMoney(x.amount_base, baseCurrency)}</div>}</div>} />
                  );
                }
                return (
                  <Row key={x.id} icon={x.kind === 'transfer' ? '🔁' : c?.icon || '🏷️'} title={x.merchant || c?.name || t('money.' + x.kind)}
                    sub={`${fmtDay(x.occurred_on)} · ${accountById(x.account_id)?.name || ''}${x.for_member_id ? ` · 👤 ${memberById(x.for_member_id)?.display_name || t('money.personal')}` : ''}${x.plan_id ? ' · 🧭' : ''}${x.receipt_path ? ' · 🧾' : ''}`}
                    end={<div><Money amount={x.amount} currency={x.currency} kind={x.kind} />{x.currency !== baseCurrency && <div className="faint">≈ {formatMoney(x.amount_base, baseCurrency)}</div>}</div>}
                    onClick={() => setEditTxn(x)} />
                );
              })}
              {shown.length === 0 && <Empty>{t('common.empty')}</Empty>}
              {shown.length > 0 && (
                <>
                  <div className="spacer" />
                  <div className="between">
                    <span className="muted">{t('money.shownTotal', shown.length)}</span>
                    <span className="money money--expense">{formatMoney(shownTotal, baseCurrency)}</span>
                  </div>
                </>
              )}
            </Card>
          </>
        );
      })()}

      {tab === 'report' && (
        <>
          {/* Rapor iki ayrı hikâye anlatıyor: ailenin parası ve benim kişisel
              harcamam. Karıştırılırsa kişisel harcama aile ortalamasını şişirir. */}
          <Chips value={scope} onChange={setScope} options={[
            { value: 'family', label: '👨‍👩‍👧 ' + t('money.family') },
            { value: 'personal', label: '👤 ' + t('money.personal') }]} />
          <div className="spacer" />
          {trend
            ? <MoneyReport trend={trend} baseCurrency={baseCurrency} range={range} onRange={setRange} />
            : <Empty>{t('common.loading')}</Empty>}
        </>
      )}

      {tab === 'budgets' && (
        <>
          <div className="section-title">👨‍👩‍👧 {t('money.familyLimit')}</div>
          <BudgetsTab t={t} budget={budget} period={period} baseCurrency={baseCurrency} categories={categories} repo={repo} bump={bump} />
          <KisiselKart t={t} kisisel={kisisel} baseCurrency={baseCurrency} repo={repo} bump={bump}
            acik={limitAcik} setAcik={setLimitAcik} />
        </>
      )}

      {tab === 'accounts' && (
        <Card>
          {balances.map((a) => (
            <Row key={a.account_id} icon={a.icon} title={a.name} sub={`${t('money.balance')} · ${a.currency}`} end={<div><span className="money">{formatMoney(a.balance, a.currency)}</span>{a.currency !== baseCurrency && a.balance_base != null && <div className="faint">≈ {formatMoney(a.balance_base, baseCurrency)}</div>}</div>} />
          ))}
          <div className="spacer" />
          <div className="between"><span className="muted">{t('money.totalIn', baseCurrency)}</span><span className="money">{formatMoney(balances.reduce((s, a) => s + (a.balance_base ?? (a.currency === baseCurrency ? a.balance : 0)), 0), baseCurrency)}</span></div>
        </Card>
      )}

      {tab === 'accounts' && <DuzenliOdemeler bills={bills} baseCurrency={baseCurrency} odeId={odeId} />}

      {adding && <Sheet onClose={() => setAdding(false)} title={t('money.addTxn')}><ExpenseForm onDone={() => setAdding(false)} /></Sheet>}
      {editTxn && (
        <Sheet onClose={() => setEditTxn(null)} title={t('money.editTxn')}>
          <ExpenseForm txn={editTxn} onDone={() => setEditTxn(null)} />
        </Sheet>
      )}
    </>
  );
}

function BudgetsTab({ t, budget, period, baseCurrency, categories, repo, bump }) {
  const [catId, setCatId] = useState('');
  const [amt, setAmt] = useState('');
  const [removing, setRemoving] = useState(null);   // silinmeyi bekleyen zarf
  const parents = categories.filter((c) => c.kind === 'expense' && !c.parent_id);

  const save = async (e) => {
    e.preventDefault();
    const minor = parseAmount(amt, baseCurrency); if (!minor) return;
    await repo.budgets.set({ period, category_id: catId || null, amount_base: minorToDecimal(minor, baseCurrency) });
    setAmt(''); bump();
  };

  // Satıra basınca o zarf forma yüklenir; kaydet üzerine yazar.
  const edit = (b) => {
    setCatId(b.category_id || '');
    setAmt(String(minorToDecimal(b.budget, baseCurrency)));
    setRemoving(null);
  };

  const over = budget.filter((b) => budgetState(b.spent, b.budget).state === 'over');
  const warn = budget.filter((b) => budgetState(b.spent, b.budget).state === 'warn');
  const isThisMonth = period === periodOf(today());

  return (
    <>
      {over.length > 0 && (
        <div className="banner" style={{ color: 'var(--color-danger)' }}>
          {t('money.overWarning', over.map((b) => b.category_id ? b.category_name : t('money.totalBudget')).join(', '))}
        </div>
      )}
      {over.length === 0 && warn.length > 0 && (
        <div className="banner" style={{ color: 'var(--color-warn)' }}>
          {t('money.nearWarning', warn.map((b) => b.category_id ? b.category_name : t('money.totalBudget')).join(', '))}
        </div>
      )}

      <Card>
        {budget.map((b) => {
          const st = budgetState(b.spent, b.budget);
          const perDay = isThisMonth && b.remaining > 0 ? dailyAllowance(b.remaining) : null;
          return (
            <Row key={b.category_id || 'total'} icon={b.icon} title={b.category_id ? b.category_name : t('money.totalBudget')}
              onClick={() => edit(b)}
              end={<span className={'tag ' + (st.state === 'over' ? 'tag--danger' : st.state === 'warn' ? 'tag--warn' : 'tag--ok')}>{t('common.pct', Math.round(st.rawPct ?? b.pct))}</span>}>
              <div className="faint">
                {formatMoney(b.spent, baseCurrency)} / {formatMoney(b.budget, baseCurrency)} · {b.remaining >= 0
                  ? formatMoney(b.remaining, baseCurrency) + ' ' + t('money.left')
                  : formatMoney(-b.remaining, baseCurrency) + ' ' + t('money.over')}
                {perDay !== null && ` · ${formatMoney(perDay, baseCurrency)} / ${t('today.perDay')}`}
                {b.from_period && b.from_period < period && ` · ↻ ${t('money.carried')}`}
              </div>
              <div style={{ marginTop: 6 }}><Bar pct={b.pct} state={st.state} /></div>
            </Row>
          );
        })}
        {budget.length === 0 && <Empty>{t('money.noBudget')}</Empty>}
        {budget.length > 0 && <div className="faint" style={{ marginTop: 'var(--sp-3)' }}>{t('money.budgetCarry')}</div>}
      </Card>

      <Card title={catId || amt ? t('money.editBudget') : `+ ${t('money.addBudget')}`}>
        <form onSubmit={save} className="grid-3" style={{ alignItems: 'end' }}>
          <Field label={t('money.category')}>
            <select className="select" value={catId} onChange={(e) => setCatId(e.target.value)}>
              <option value="">🎯 {t('money.totalBudget')}</option>
              {parents.map((c) => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
            </select>
          </Field>
          <Field label={`${t('money.amount')} (${baseCurrency})`}><input className="input" inputMode="decimal" value={amt} onChange={(e) => setAmt(e.target.value)} /></Field>
          <button className="btn" style={{ marginBottom: 'var(--sp-4)' }}>{t('common.save')}</button>
        </form>
        {budget.some((b) => (b.category_id || '') === catId) && (
          removing === catId ? (
            <div className="grid-2">
              <button type="button" className="btn btn--ghost" onClick={() => setRemoving(null)}>{t('common.cancel')}</button>
              <button type="button" className="btn btn--danger" onClick={async () => { await repo.budgets.remove(period, catId || null); setRemoving(null); setAmt(''); bump(); }}>{t('common.yesDelete')}</button>
            </div>
          ) : (
            <button type="button" className="btn btn--ghost btn--block" onClick={() => setRemoving(catId)}>{t('money.removeBudget')}</button>
          )
        )}
      </Card>
    </>
  );
}

/**
 * Kişisel harcamam (0027). Yalnızca BENİM kişisel toplamım ve limitim;
 * eşin kendi ekranında kendininkini görür. Limit aylık ve kalıcı — her ay
 * yeniden girilmiyor. Aile bütçesinden bağımsız.
 */
function KisiselKart({ t, kisisel, baseCurrency, repo, bump, acik, setAcik }) {
  const [tutar, setTutar] = useState('');
  const [busy, setBusy] = useState(false);
  const limit = Number(kisisel.limit || 0);
  const st = limit > 0 ? budgetState(kisisel.total, limit) : null;

  const kaydet = async (e) => {
    e.preventDefault();
    const minor = parseAmount(tutar, baseCurrency);
    if (!minor) return;
    setBusy(true);
    try { await repo.budgets.setPersonalLimit(minorToDecimal(minor, baseCurrency)); setTutar(''); setAcik(false); bump(); }
    finally { setBusy(false); }
  };
  const kaldir = async () => {
    setBusy(true);
    try { await repo.budgets.setPersonalLimit(0); setAcik(false); bump(); } finally { setBusy(false); }
  };

  return (
    <Card title={`👤 ${t('money.personalSpend')}`}
      action={<span className="money">{formatMoney(kisisel.total, baseCurrency)}</span>}>
      {limit > 0 && (
        <>
          <Bar pct={st.pct} state={st.state} />
          <div className="between faint" style={{ marginTop: 4 }}>
            <span>{t('money.personalLimit')}: {formatMoney(limit, baseCurrency)}</span>
            <span>{limit - kisisel.total >= 0
              ? `${formatMoney(limit - kisisel.total, baseCurrency)} ${t('money.left')}`
              : `${formatMoney(kisisel.total - limit, baseCurrency)} ${t('money.over')}`}</span>
          </div>
        </>
      )}
      {kisisel.by_category.slice(0, 3).map((c) => (
        <Row key={c.category_id} icon={c.icon} title={c.name} end={<Money amount={c.total} currency={baseCurrency} />} />
      ))}
      {kisisel.total === 0 && <div className="faint" style={{ margin: 'var(--sp-2) 0' }}>{t('money.noPersonal')}</div>}

      {acik ? (
        <form onSubmit={kaydet} className="inline" style={{ flexWrap: 'nowrap', marginTop: 'var(--sp-3)' }}>
          <input className="input" inputMode="decimal" autoFocus placeholder={limit ? String(limit) : '0'}
            value={tutar} onChange={(e) => setTutar(e.target.value)} aria-label={t('money.personalLimit')} />
          <button className="btn" disabled={busy}>{t('common.save')}</button>
          {limit > 0 && <button type="button" className="btn btn--ghost" disabled={busy} onClick={kaldir}>{t('money.removeLimit')}</button>}
        </form>
      ) : (
        <button type="button" className="btn btn--ghost btn--sm" style={{ marginTop: 'var(--sp-2)', paddingLeft: 0 }}
          onClick={() => setAcik(true)}>{limit ? t('money.changeLimit') : '+ ' + t('money.setLimit')}</button>
      )}
      <div className="faint" style={{ marginTop: 'var(--sp-2)' }}>{t('money.personalNote')}</div>
    </Card>
  );
}
