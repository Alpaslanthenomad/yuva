'use client';
import { useEffect, useState } from 'react';
import { useApp } from '../../components/AppShell.jsx';
import { Card, Row, Bar, Chips, Empty, Sheet, Field } from '../../components/ui.jsx';
import { ExpenseForm, TaskForm } from '../../components/QuickAdd.jsx';
import { useT } from '../../lib/i18n/context.jsx';
import { today, daysBetween, fmtDay } from '../../lib/dates.js';
import { formatMoney, budgetState, parseAmount, minorToDecimal, planTotals, CURRENCY_CODES } from '../../lib/money.js';

const KINDS = ['trip', 'gathering', 'project', 'goal'];
const ICONS = { trip: '✈️', gathering: '🎉', project: '🔨', goal: '🎯' };

export default function PlansPage() {
  const { repo, household, tick, baseCurrency, rates, memberById, bump } = useApp();
  const t = useT();
  const [plans, setPlans] = useState(null);
  const [filter, setFilter] = useState('all');
  const [openId, setOpenId] = useState(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => { if (household) repo.plans.list().then(setPlans); }, [repo, household, tick]);
  if (!plans) return <Empty>{t('common.loading')}</Empty>;

  const list = plans.filter((p) => filter === 'all' || p.kind === filter);
  const open = plans.find((p) => p.id === openId);

  return (
    <>
      <div className="page-head">
        <h1 className="h1">{t('plans.title')}</h1>
        <button className="btn btn--sm" onClick={() => setCreating(true)}>+ {t('common.add')}</button>
      </div>
      <Chips value={filter} onChange={setFilter} options={[{ value: 'all', label: t('common.all') }, ...KINDS.map((k) => ({ value: k, label: `${ICONS[k]} ${t('plans.' + k)}` }))]} />
      <div className="spacer" />
      {list.map((p) => <PlanCard key={p.id} t={t} plan={p} onOpen={() => setOpenId(p.id)} baseCurrency={baseCurrency} rates={rates} repo={repo} tick={tick} />)}
      {list.length === 0 && <Empty>{t('common.empty')}</Empty>}

      {open && <PlanDetail t={t} plan={open} onClose={() => setOpenId(null)} repo={repo} tick={tick} bump={bump} baseCurrency={baseCurrency} rates={rates} memberById={memberById} />}
      {creating && <Sheet onClose={() => setCreating(false)} title={t('plans.newPlan')}><PlanForm t={t} onDone={() => setCreating(false)} /></Sheet>}
    </>
  );
}

function usePlanNumbers(plan, repo, tick, baseCurrency, rates) {
  const [n, setN] = useState({ actual: 0, items: [], contrib: 0 });
  useEffect(() => {
    (async () => {
      const [txns, items, contrib] = await Promise.all([
        repo.transactions.list({ planId: plan.id }), repo.plans.items(plan.id),
        plan.kind === 'goal' && repo.plans.contributions ? repo.plans.contributions(plan.id) : Promise.resolve([]),
      ]);
      const cur = plan.budget_currency || baseCurrency;
      const { spent, contributed } = planTotals(txns, contrib, baseCurrency, cur, rates);
      setN({ actual: spent, items, contrib: contributed });
    })();
  }, [plan, repo, tick, baseCurrency, rates]);
  return n;
}

function PlanCard({ t, plan, onOpen, baseCurrency, rates, repo, tick }) {
  const { actual, items, contrib } = usePlanNumbers(plan, repo, tick, baseCurrency, rates);
  const cur = plan.budget_currency || baseCurrency;
  const T = today();
  const isGoal = plan.kind === 'goal';
  const target = isGoal ? Number(plan.target_amount) : Number(plan.budget_amount || 0);
  const progress = isGoal ? contrib : actual;
  const st = budgetState(progress, target);
  const checks = items.filter((i) => i.kind === 'checklist');
  const done = checks.length ? Math.round((checks.filter((i) => i.is_done).length / checks.length) * 100) : null;
  return (
    <Card>
      <div className="row" onClick={onOpen} style={{ cursor: 'pointer', borderBottom: 0, padding: 0 }}>
        <div className="row__icon" style={{ background: plan.color || 'var(--color-surface-2)', color: '#fff' }}>{plan.icon || ICONS[plan.kind]}</div>
        <div className="row__body">
          <div className="row__title row__title--wrap">{plan.title}</div>
          <div className="row__sub">{t('plans.' + plan.kind)} · {t('plans.statuses.' + plan.status)}{plan.destination ? ` · ${plan.destination}` : ''}{plan.starts_on ? ` · ${fmtDay(plan.starts_on)}` : ''}{plan.starts_on && plan.starts_on > T ? ` · ${t('plans.daysLeft', daysBetween(T, plan.starts_on))}` : ''}</div>
        </div>
        <div className="row__end">{done !== null && <span className="tag tag--ok">✓ {t('common.pct', done)}</span>}</div>
      </div>
      {target > 0 && (
        <div style={{ marginTop: 'var(--sp-3)' }}>
          <div className="between faint"><span>{isGoal ? t('plans.progress') : t('plans.actual')}: {formatMoney(progress, cur)}</span><span>{isGoal ? t('plans.target') : t('plans.budget')}: {formatMoney(target, cur)}</span></div>
          <div style={{ marginTop: 4 }}><Bar pct={st.pct} state={isGoal ? 'ok' : st.state} /></div>
        </div>
      )}
    </Card>
  );
}

function PlanDetail({ t, plan, onClose, repo, tick, bump, baseCurrency, rates, memberById }) {
  const { actual, items } = usePlanNumbers(plan, repo, tick, baseCurrency, rates);
  const [sub, setSub] = useState('items');
  const [newItem, setNewItem] = useState('');
  const [newKind, setNewKind] = useState('checklist');
  const cur = plan.budget_currency || baseCurrency;
  const groups = { itinerary: t('plans.itinerary'), booking: t('plans.bookings'), checklist: t('plans.checklist'), guest: t('plans.guests'), note: t('common.note') };
  const add = async (e) => {
    e.preventDefault(); if (!newItem.trim()) return;
    await repo.plans.addItem({ plan_id: plan.id, kind: newKind, title: newItem.trim(), guest_name: newKind === 'guest' ? newItem.trim() : null, rsvp: newKind === 'guest' ? 'invited' : null });
    setNewItem(''); bump();
  };
  const RSVP = { invited: '⏳', yes: '✅', no: '❌', maybe: '🤔' };
  const guests = items.filter((i) => i.kind === 'guest');
  const guestsYes = guests.filter((i) => i.rsvp === 'yes').reduce((s, i) => s + (i.guest_count || 1), 0);

  return (
    <Sheet onClose={onClose} title={`${plan.icon || ''} ${plan.title}`}>
      <div className="faint" style={{ marginBottom: 'var(--sp-3)' }}>{t('plans.' + plan.kind)} · {t('plans.statuses.' + plan.status)}{plan.starts_on ? ` · ${fmtDay(plan.starts_on)}${plan.ends_on && plan.ends_on !== plan.starts_on ? ' – ' + fmtDay(plan.ends_on) : ''}` : ''}</div>
      {plan.budget_amount && (
        <div className="stats" style={{ marginBottom: 'var(--sp-3)' }}>
          <div className="stat"><div className="stat__label">{t('plans.budget')}</div><div className="stat__value">{formatMoney(plan.budget_amount, cur, { compact: true })}</div></div>
          <div className="stat"><div className="stat__label">{t('plans.actual')}</div><div className="stat__value money--expense">{formatMoney(actual, cur, { compact: true })}</div></div>
          <div className="stat"><div className="stat__label">{t('money.left')}</div><div className="stat__value">{formatMoney(plan.budget_amount - actual, cur, { compact: true })}</div></div>
        </div>
      )}
      {plan.kind === 'gathering' && <div className="banner" style={{ background: 'var(--color-brand-soft)', color: 'var(--color-brand-ink)' }}>👥 {t('plans.guests')}: {t('plans.guestSummary', guestsYes, guests.length)}</div>}
      <Chips value={sub} onChange={setSub} options={[{ value: 'items', label: '📋 ' + t('plans.items') }, { value: 'expense', label: '💸 ' + t('quick.expense') }, { value: 'task', label: '✅ ' + t('quick.task') }]} />
      <div className="spacer" />
      {sub === 'items' && (
        <>
          {Object.entries(groups).map(([k, label]) => {
            const rows = items.filter((i) => i.kind === k);
            if (!rows.length) return null;
            return (
              <Card key={k} title={label} className="card--flat">
                {rows.map((i) => (
                  <Row key={i.id}
                    icon={k === 'checklist' ? <input type="checkbox" checked={i.is_done} onChange={async () => { await repo.plans.updateItem(i.id, { is_done: !i.is_done }); bump(); }} style={{ width: 22, height: 22 }} /> : k === 'guest' ? <button onClick={async () => { const order = ['invited', 'yes', 'maybe', 'no']; await repo.plans.updateItem(i.id, { rsvp: order[(order.indexOf(i.rsvp) + 1) % 4] }); bump(); }}>{RSVP[i.rsvp] || '⏳'}</button> : k === 'booking' ? (i.is_done ? '✅' : '🎫') : k === 'itinerary' ? '📍' : '📝'}
                    title={i.title} done={k === 'checklist' && i.is_done}
                    sub={[i.on_date && fmtDay(i.on_date), i.ref_code, i.assignee_member_id && memberById(i.assignee_member_id)?.display_name, i.guest_count && t('plans.people', i.guest_count)].filter(Boolean).join(' · ')}
                    end={i.amount ? <span className="money">{formatMoney(i.amount, i.currency || cur)}</span> : null} />
                ))}
              </Card>
            );
          })}
          <form onSubmit={add} className="inline" style={{ flexWrap: 'nowrap' }}>
            <select className="select" style={{ width: 150 }} value={newKind} onChange={(e) => setNewKind(e.target.value)}>
              {Object.entries(groups).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <input className="input" value={newItem} onChange={(e) => setNewItem(e.target.value)} placeholder="…" />
            <button className="btn">{t('common.add')}</button>
          </form>
        </>
      )}
      {sub === 'expense' && <ExpenseForm planId={plan.id} onDone={() => setSub('items')} />}
      {sub === 'task' && <TaskForm planId={plan.id} onDone={() => setSub('items')} />}
    </Sheet>
  );
}

function PlanForm({ t, onDone }) {
  const { repo, bump, baseCurrency } = useApp();
  const [kind, setKind] = useState('trip');
  const [title, setTitle] = useState('');
  const [dest, setDest] = useState('');
  const [s, setS] = useState('');
  const [e, setE] = useState('');
  const [budget, setBudget] = useState('');
  const [cur, setCur] = useState(baseCurrency);
  const submit = async (ev) => {
    ev.preventDefault(); if (!title.trim()) return;
    const minor = parseAmount(budget, cur);
    await repo.plans.create({
      kind, title: title.trim(), destination: dest || null, starts_on: s || null, ends_on: e || s || null,
      budget_amount: kind !== 'goal' && minor ? minorToDecimal(minor, cur) : null, target_amount: kind === 'goal' && minor ? minorToDecimal(minor, cur) : null,
      budget_currency: cur, icon: ICONS[kind], status: 'planned',
    });
    bump(); onDone();
  };
  return (
    <form onSubmit={submit}>
      <Chips value={kind} onChange={setKind} options={KINDS.map((k) => ({ value: k, label: `${ICONS[k]} ${t('plans.' + k)}` }))} />
      <div className="spacer" />
      <Field label={t('calendar.titleField')}><input className="input" autoFocus value={title} onChange={(x) => setTitle(x.target.value)} /></Field>
      {kind !== 'goal' && <Field label={t('calendar.location')}><input className="input" value={dest} onChange={(x) => setDest(x.target.value)} /></Field>}
      <div className="grid-2">
        <Field label={t('calendar.start')}><input className="input" type="date" value={s} onChange={(x) => setS(x.target.value)} /></Field>
        <Field label={t('calendar.end')}><input className="input" type="date" value={e} onChange={(x) => setE(x.target.value)} /></Field>
      </div>
      <div className="grid-2">
        <Field label={kind === 'goal' ? t('plans.target') : t('plans.budget')}><input className="input" inputMode="decimal" value={budget} onChange={(x) => setBudget(x.target.value)} /></Field>
        <Field label={t('money.currency')}><select className="select" value={cur} onChange={(x) => setCur(x.target.value)}>{CURRENCY_CODES.map((c) => <option key={c}>{c}</option>)}</select></Field>
      </div>
      <button className="btn btn--block">{t('common.save')}</button>
    </form>
  );
}
