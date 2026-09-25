'use client';
import { useEffect, useState } from 'react';
import { useApp } from '../../components/AppShell.jsx';
import { Card, Row, Money, Bar, Chips, Empty, Sheet, Field } from '../../components/ui.jsx';
import { ExpenseForm } from '../../components/QuickAdd.jsx';
import MoneyReport from '../../components/MoneyReport.jsx';
import { useT } from '../../lib/i18n/context.jsx';
import { today, periodOf, addMonths, fmtPeriod, fmtDay, relativeLabel } from '../../lib/dates.js';
import { formatMoney, budgetState, dailyAllowance, parseAmount, minorToDecimal } from '../../lib/money.js';

const TABS = ['overview', 'transactions', 'report', 'budgets', 'bills', 'accounts'];

export default function MoneyPage() {
  const { repo, household, baseCurrency, categoryById, memberById, accountById, categories, members, tick, bump } = useApp();
  const t = useT();
  const [tab, setTab] = useState('overview');
  const [period, setPeriod] = useState(periodOf(today()));
  const [d, setD] = useState(null);
  const [adding, setAdding] = useState(false);
  const [editTxn, setEditTxn] = useState(null);      // düzenlenen işlem
  const [fMember, setFMember] = useState('');        // filtre: kim için
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
      const r = await repo.summary.trend(period, range);
      if (!iptal) setTrend(r);
    })();
    return () => { iptal = true; };
  }, [repo, household, period, range, tab, tick]);

  if (!d) return <Empty>{t('common.loading')}</Empty>;
  const { month, prev, budget, txns, bills, balances } = d;
  const net = month.income - month.expense;
  const savings = month.income > 0 ? Math.round((net / month.income) * 100) : 0;
  const delta = prev.expense > 0 ? Math.round(((month.expense - prev.expense) / prev.expense) * 100) : null;
  const total = budget.find((b) => b.category_id === null);
  const catTotal = month.by_category.reduce((s, c) => s + c.total, 0) || 1;

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="h1">{t('money.title')}</h1>
          <div className="page-head__sub inline">
            <button className="btn btn--ghost btn--sm" onClick={() => setPeriod(periodOf(addMonths(period + '-01', -1)))}>‹</button>
            <span>{fmtPeriod(period)}</span>
            <button className="btn btn--ghost btn--sm" onClick={() => setPeriod(periodOf(addMonths(period + '-01', 1)))}>›</button>
          </div>
        </div>
        <button className="btn btn--sm" onClick={() => setAdding(true)}>+ {t('money.addTxn')}</button>
      </div>
      <Chips value={tab} onChange={setTab} options={TABS.map((k) => ({ value: k, label: t('money.' + k) }))} />
      <div className="spacer" />

      {tab === 'overview' && (
        <>
          <div className="stats" style={{ marginBottom: 'var(--sp-3)' }}>
            <div className="stat"><div className="stat__label">{t('money.income')}</div><div className="stat__value money--income">{formatMoney(month.income, baseCurrency, { compact: true })}</div></div>
            <div className="stat"><div className="stat__label">{t('money.expense')}</div><div className="stat__value money--expense">{formatMoney(month.expense, baseCurrency, { compact: true })}</div>{delta !== null && <div className="faint">{delta > 0 ? '▲' : '▼'} {t('common.pct', Math.abs(delta))} {t('money.vsLastMonth')}</div>}</div>
            <div className="stat"><div className="stat__label">{t('money.net')}</div><div className="stat__value">{formatMoney(net, baseCurrency, { compact: true })}</div><div className="faint">{t('money.savingsRate')} {t('common.pct', savings)}</div></div>
          </div>

          {total ? (
            <Card title={t('money.monthBudget')}>
              <div className="between"><span className="muted">{formatMoney(total.spent, baseCurrency)} / {formatMoney(total.budget, baseCurrency)}</span><span className="money">{formatMoney(total.remaining, baseCurrency)} {t('money.left')}</span></div>
              <div style={{ margin: 'var(--sp-2) 0' }}><Bar pct={total.pct} state={budgetState(total.spent, total.budget).state} /></div>
              <div className="faint">{formatMoney(dailyAllowance(total.remaining), baseCurrency)} / {t('today.perDay')}</div>
            </Card>
          ) : <div className="banner">{t('money.noBudget')}</div>}

          <Card title={t('money.byCategory')}>
            {month.by_category.map((c) => (
              <Row key={c.category_id} icon={c.icon} title={c.name} end={<Money amount={c.total} currency={baseCurrency} />}>
                <div style={{ marginTop: 6 }}><Bar pct={(c.total / catTotal) * 100} /></div>
              </Row>
            ))}
            {month.by_category.length === 0 && <Empty>{t('common.empty')}</Empty>}
          </Card>

          <div className="grid-2">
            <Card title={t('money.byMember')}>
              {month.by_member.map((m) => <Row key={m.member_id} title={m.name} end={<span className="money">{formatMoney(m.total, baseCurrency, { compact: true })}</span>} />)}
              {month.by_member.length === 0 && <Empty>{t('common.empty')}</Empty>}
            </Card>
            <Card title={`${t('money.fixed')} / ${t('money.variable')}`}>
              <Row title={t('money.fixed')} end={<span className="money">{formatMoney(month.fixed || 0, baseCurrency, { compact: true })}</span>} />
              <Row title={t('money.variable')} end={<span className="money">{formatMoney(month.variable ?? month.expense, baseCurrency, { compact: true })}</span>} />
            </Card>
          </div>
        </>
      )}

      {tab === 'transactions' && (() => {
        // Filtre yalnızca görüntüyü daraltır; toplamlar filtreye göre yeniden hesaplanır.
        const shown = txns.filter((x) =>
          (!fMember || x.for_member_id === fMember) &&
          (!fCategory || x.category_id === fCategory || categoryById(x.category_id)?.parent_id === fCategory) &&
          // Transfer iki hesabı ilgilendirir; hesap filtresinde her ikisinde de görünmeli.
          (!fAccount || x.account_id === fAccount || x.transfer_account_id === fAccount) &&
          (!fKind || x.kind === fKind));
        const shownTotal = shown.filter((x) => x.kind === 'expense')
          .reduce((s, x) => s + Number(x.amount_base ?? x.amount), 0);
        return (
          <>
            <div className="grid-2" style={{ marginBottom: 'var(--sp-3)' }}>
              <Field label={t('money.forWhom')}>
                <select className="select" value={fMember} onChange={(e) => setFMember(e.target.value)}>
                  <option value="">{t('common.all')}</option>
                  {members.map((m) => <option key={m.id} value={m.id}>{m.avatar_emoji} {m.display_name}</option>)}
                </select>
              </Field>
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
            <Card>
              {shown.map((x) => {
                const c = categoryById(x.category_id);
                return (
                  <Row key={x.id} icon={x.kind === 'transfer' ? '🔁' : c?.icon || '🏷️'} title={x.merchant || c?.name || t('money.' + x.kind)}
                    sub={`${fmtDay(x.occurred_on)} · ${accountById(x.account_id)?.name || ''}${x.for_member_id ? ' · ' + memberById(x.for_member_id)?.display_name : ''}${x.plan_id ? ' · 🧭' : ''}`}
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

      {tab === 'report' && (trend
        ? <MoneyReport trend={trend} baseCurrency={baseCurrency} range={range} onRange={setRange} />
        : <Empty>{t('common.loading')}</Empty>)}

      {tab === 'budgets' && <BudgetsTab t={t} budget={budget} period={period} baseCurrency={baseCurrency} categories={categories} repo={repo} bump={bump} />}

      {tab === 'bills' && (
        <Card>
          {bills.map((b) => (
            <Row key={b.id} icon={categoryById(b.category_id)?.icon || '🧾'} title={b.name} sub={`${t('money.nextDue')}: ${fmtDay(b.next_due_on)} · ${relativeLabel(b.next_due_on)}${b.auto_post ? ' · ⚙︎ ' + t('money.autoPost') : ''}`} end={<Money amount={b.amount} currency={b.currency} kind={b.kind} />} />
          ))}
          {bills.length === 0 && <Empty>{t('common.empty')}</Empty>}
          <div className="spacer" />
          <div className="between muted"><span>{t('money.monthlyFixed')}</span><span className="money">{formatMoney(bills.filter((b) => b.kind === 'expense' && b.currency === baseCurrency).reduce((s, b) => s + Number(b.amount), 0), baseCurrency)} +</span></div>
        </Card>
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
              </div>
              <div style={{ marginTop: 6 }}><Bar pct={b.pct} state={st.state} /></div>
            </Row>
          );
        })}
        {budget.length === 0 && <Empty>{t('money.noBudget')}</Empty>}
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
