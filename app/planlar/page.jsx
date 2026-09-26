'use client';
import { useEffect, useState } from 'react';
import { useApp } from '../../components/AppShell.jsx';
import { Card, Row, Bar, Chips, Empty, Sheet, Field } from '../../components/ui.jsx';
import { ExpenseForm, TaskForm } from '../../components/QuickAdd.jsx';
import { useT, useLocale } from '../../lib/i18n/context.jsx';
import { PLAN_GROUPS, PLAN_CATEGORIES, planCategory, categoryName, categoryHint, categoryList, groupName, planSection } from '../../lib/planCatalog.js';
import { today, daysBetween, fmtDay, fmtDayLong } from '../../lib/dates.js';
import { formatMoney, budgetState, parseAmount, minorToDecimal, planTotals, CURRENCY_CODES } from '../../lib/money.js';

const STATUSES = ['idea', 'planned', 'active', 'done', 'cancelled'];
const mapLink = (q) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;

/** Geri sayım etiketi (bugün, yarın, n gün sonra, sürüyor). Tarihsiz planda null. */
function gunEtiketi(plan, T, t) {
  if (!plan.starts_on) return null;
  const son = plan.ends_on || plan.starts_on;
  if (plan.starts_on < T && son >= T) return t('plans.ongoing');
  const n = daysBetween(T, plan.starts_on);
  if (n === 0) return t('plans.today');
  if (n === 1) return t('plans.tomorrow');
  return n > 1 ? t('plans.inDays', n) : null;
}

/**
 * PLANLAR
 *
 * Kullanıcının itirazı: "sayfa çok boş; arkadaşlar evine davet etti, bunu
 * planlayamıyorum." Önceki sayfa dört soyut türden birini seçtiriyor ve her
 * plana bütçe soruyordu. Şimdi:
 *   1. Üstte YAKLAŞAN planlar, geri sayımla ("Yarın", "3 gün sonra").
 *   2. Altında "Ne planlıyoruz?" — ikonlu kategori ızgarası. Dokununca form o
 *      kategorinin varsayılanlarıyla (para var mı, hazır liste) açılıyor.
 *   3. Tarihsiz fikirler, birikim hedefleri, en altta katlı geçmiş.
 * Para her planda İSTEĞE BAĞLI: misafirliğe gitmenin bütçesi yok.
 */
export default function PlansPage() {
  const { repo, household, tick, baseCurrency, rates, memberById, bump } = useApp();
  const t = useT();
  const { locale } = useLocale();
  const [plans, setPlans] = useState(null);
  const [openId, setOpenId] = useState(null);
  const [creating, setCreating] = useState(null);   // kategori anahtarı
  const [gecmisAcik, setGecmisAcik] = useState(false);

  useEffect(() => { if (household) repo.plans.list().then(setPlans); }, [repo, household, tick]);
  if (!plans) return <Empty>{t('common.loading')}</Empty>;

  const T = today();
  const bolum = (k) => plans.filter((p) => planSection(p, T) === k);
  const yaklasan = bolum('upcoming').sort((a, b) =>
    (a.starts_on + (a.start_time || '')).localeCompare(b.starts_on + (b.start_time || '')));
  const fikirler = bolum('ideas');
  const hedefler = bolum('goals');
  const gecmis = bolum('past').sort((a, b) => String(b.starts_on || '').localeCompare(String(a.starts_on || '')));
  const open = plans.find((p) => p.id === openId);
  const kart = (p) => (
    <PlanCard key={p.id} t={t} locale={locale} plan={p} T={T} onOpen={() => setOpenId(p.id)}
      baseCurrency={baseCurrency} rates={rates} repo={repo} tick={tick} />
  );

  return (
    <>
      <div className="page-head">
        <h1 className="h1">{t('plans.title')}</h1>
        <button className="btn btn--sm" onClick={() => setCreating('visit')}>+ {t('plans.newPlan')}</button>
      </div>

      <div className="section-title">{t('plans.upcoming')}</div>
      {yaklasan.length ? yaklasan.map(kart) : <Card className="card--flat"><Empty>{t('plans.emptyUpcoming')}</Empty></Card>}

      <div className="section-title">{t('plans.whatPlanning')}</div>
      <CategoryGrid locale={locale} onPick={setCreating} />
      <div className="faint" style={{ margin: 'var(--sp-2) 0 var(--sp-4)' }}>{t('plans.startHint')}</div>

      {fikirler.length > 0 && (
        <>
          <div className="section-title">{t('plans.ideas')} <span className="faint">· {t('plans.ideasHint')}</span></div>
          {fikirler.map(kart)}
        </>
      )}
      {hedefler.length > 0 && (
        <>
          <div className="section-title">{t('plans.goals')}</div>
          {hedefler.map(kart)}
        </>
      )}
      {gecmis.length > 0 && (
        <>
          <button type="button" className="btn btn--ghost btn--block" onClick={() => setGecmisAcik((x) => !x)}>
            {t('plans.past', gecmis.length)} {gecmisAcik ? '▲' : '▼'}
          </button>
          {gecmisAcik && gecmis.map(kart)}
        </>
      )}

      {open && <PlanDetail t={t} locale={locale} plan={open} onClose={() => setOpenId(null)} repo={repo} tick={tick} bump={bump} baseCurrency={baseCurrency} rates={rates} memberById={memberById} />}
      {creating && (
        <Sheet onClose={() => setCreating(null)} title={t('plans.newPlan')}>
          <PlanForm t={t} categoryKey={creating} onDone={() => setCreating(null)} />
        </Sheet>
      )}
    </>
  );
}

/** Gruplu, ikonlu kategori ızgarası (yeni plan başlatma). */
function CategoryGrid({ locale, onPick }) {
  return PLAN_GROUPS.map((g) => (
    <div key={g.key} style={{ marginBottom: 'var(--sp-3)' }}>
      <div className="oneri__baslik">{groupName(g, locale)}</div>
      <div className="picker">
        {PLAN_CATEGORIES.filter((c) => c.group === g.key).map((c) => (
          <button key={c.key} type="button" className="picker__item" onClick={() => onPick(c.key)}>
            <span className="picker__emoji" aria-hidden="true">{c.emoji}</span>
            <span className="picker__name">{categoryName(c, locale)}</span>
          </button>
        ))}
      </div>
    </div>
  ));
}

function usePlanNumbers(plan, repo, tick, baseCurrency, rates) {
  const [n, setN] = useState({ actual: 0, items: [], contrib: 0 });
  useEffect(() => {
    let iptal = false;
    (async () => {
      // Parası olmayan planda harcama sorgusu boşuna; yalnızca liste gerekiyor.
      const [txns, items, contrib] = await Promise.all([
        plan.has_money === false ? Promise.resolve([]) : repo.transactions.list({ planId: plan.id }),
        repo.plans.items(plan.id),
        plan.kind === 'goal' && repo.plans.contributions ? repo.plans.contributions(plan.id) : Promise.resolve([]),
      ]);
      const cur = plan.budget_currency || baseCurrency;
      const { spent, contributed } = planTotals(txns, contrib, baseCurrency, cur, rates);
      if (!iptal) setN({ actual: spent, items, contrib: contributed });
    })();
    return () => { iptal = true; };
  }, [plan, repo, tick, baseCurrency, rates]);
  return n;
}

function PlanCard({ t, locale, plan, T, onOpen, baseCurrency, rates, repo, tick }) {
  const { actual, items, contrib } = usePlanNumbers(plan, repo, tick, baseCurrency, rates);
  const cat = planCategory(plan);
  const cur = plan.budget_currency || baseCurrency;
  const isGoal = plan.kind === 'goal';
  const target = isGoal ? Number(plan.target_amount) : Number(plan.budget_amount || 0);
  const progress = isGoal ? contrib : actual;
  const st = budgetState(progress, target);
  const checks = items.filter((i) => i.kind === 'checklist');
  const bitti = checks.filter((i) => i.is_done).length;
  const etiket = gunEtiketi(plan, T, t);
  const tarih = plan.starts_on
    ? `${fmtDay(plan.starts_on)}${plan.ends_on && plan.ends_on !== plan.starts_on ? ' – ' + fmtDay(plan.ends_on) : ''}${plan.start_time ? ' · ' + String(plan.start_time).slice(0, 5) : ''}`
    : t('plans.statuses.idea');
  const paraGoster = plan.has_money !== false && target > 0;

  return (
    <Card className="plan-card">
      <button type="button" className="plan-card__main" onClick={onOpen}>
        <span className="plan-card__icon" aria-hidden="true">{plan.icon || cat.emoji}</span>
        <span className="plan-card__body">
          <span className="plan-card__title">{plan.title}</span>
          <span className="plan-card__sub">{categoryName(cat, locale)} · {tarih}</span>
          {plan.destination && <span className="plan-card__sub">📍 {plan.destination}</span>}
        </span>
        <span className="plan-card__end">
          {etiket && <span className={'tag' + (etiket === t('plans.today') || etiket === t('plans.ongoing') ? ' tag--ok' : '')}>{etiket}</span>}
          {checks.length > 0 && <span className="faint">✓ {bitti}/{checks.length}</span>}
        </span>
      </button>
      {paraGoster && (
        <div style={{ marginTop: 'var(--sp-3)' }}>
          <div className="between faint"><span>{isGoal ? t('plans.progress') : t('plans.actual')}: {formatMoney(progress, cur)}</span><span>{isGoal ? t('plans.target') : t('plans.budget')}: {formatMoney(target, cur)}</span></div>
          <div style={{ marginTop: 4 }}><Bar pct={st.pct} state={isGoal ? 'ok' : st.state} /></div>
        </div>
      )}
    </Card>
  );
}

function PlanDetail({ t, locale, plan, onClose, repo, tick, bump, baseCurrency, rates, memberById }) {
  const { actual, items } = usePlanNumbers(plan, repo, tick, baseCurrency, rates);
  const [sub, setSub] = useState('items');
  const cat = planCategory(plan);
  const isGoal = plan.kind === 'goal';
  const para = plan.has_money !== false;
  const [newItem, setNewItem] = useState('');
  const [newKind, setNewKind] = useState('checklist');
  const cur = plan.budget_currency || baseCurrency;
  const groups = { checklist: t('plans.checklist'), itinerary: t('plans.itinerary'), booking: t('plans.bookings'), guest: t('plans.guests'), note: t('common.note') };
  // Misafir listesi yalnızca ağırlarken anlamlı; misafirliğe giderken değil.
  const turler = Object.entries(groups).filter(([k]) => k !== 'guest' || cat.guests);
  const add = async (e) => {
    e.preventDefault(); if (!newItem.trim()) return;
    await repo.plans.addItem({ plan_id: plan.id, kind: newKind, title: newItem.trim(), guest_name: newKind === 'guest' ? newItem.trim() : null, rsvp: newKind === 'guest' ? 'invited' : null });
    setNewItem(''); bump();
  };
  const RSVP = { invited: '⏳', yes: '✅', no: '❌', maybe: '🤔' };
  const guests = items.filter((i) => i.kind === 'guest');
  const guestsYes = guests.filter((i) => i.rsvp === 'yes').reduce((s, i) => s + (i.guest_count || 1), 0);

  return (
    <Sheet onClose={onClose} title={`${plan.icon || cat.emoji} ${plan.title}`}>
      <div className="faint" style={{ marginBottom: 'var(--sp-2)' }}>{categoryName(cat, locale)} · {t('plans.statuses.' + plan.status)}</div>
      {plan.starts_on && (
        <Row icon="📅" title={`${fmtDayLong(plan.starts_on)}${plan.start_time ? ' · ' + String(plan.start_time).slice(0, 5) : ''}`}
          sub={plan.ends_on && plan.ends_on !== plan.starts_on ? '→ ' + fmtDayLong(plan.ends_on) : null} />
      )}
      {plan.destination && (
        <Row icon="📍" title={plan.destination}
          end={<a className="btn btn--ghost btn--sm" href={mapLink(plan.destination)} target="_blank" rel="noreferrer">{t('plans.openMap')}</a>} />
      )}
      {plan.description && <p className="muted" style={{ margin: 'var(--sp-2) 0' }}>{plan.description}</p>}
      {para && plan.budget_amount && !isGoal && (
        <div className="stats" style={{ margin: 'var(--sp-3) 0' }}>
          <div className="stat"><div className="stat__label">{t('plans.budget')}</div><div className="stat__value">{formatMoney(plan.budget_amount, cur, { compact: true })}</div></div>
          <div className="stat"><div className="stat__label">{t('plans.actual')}</div><div className="stat__value money--expense">{formatMoney(actual, cur, { compact: true })}</div></div>
          <div className="stat"><div className="stat__label">{t('money.left')}</div><div className="stat__value">{formatMoney(plan.budget_amount - actual, cur, { compact: true })}</div></div>
        </div>
      )}
      {cat.guests && guests.length > 0 && <div className="banner" style={{ background: 'var(--color-brand-soft)', color: 'var(--color-brand-ink)' }}>👥 {t('plans.guests')}: {t('plans.guestSummary', guestsYes, guests.length)}</div>}
      <div className="spacer" />
      <Chips value={sub} onChange={setSub} options={[
        { value: 'items', label: '📋 ' + t('plans.items') },
        ...(isGoal ? [{ value: 'contrib', label: '🐖 ' + t('plans.contributions') }] : []),
        ...(!isGoal && para ? [{ value: 'expense', label: '💸 ' + t('quick.expense') }] : []),
        { value: 'task', label: '✅ ' + t('quick.task') },
        { value: 'edit', label: '⚙️ ' + t('common.edit') }]} />
      <div className="spacer" />
      {sub === 'items' && (
        <>
          {turler.map(([k, label]) => {
            const rows = items.filter((i) => i.kind === k);
            if (!rows.length) return null;
            return (
              <Card key={k} title={label} className="card--flat">
                {rows.map((i) => (
                  <Row key={i.id}
                    icon={k === 'checklist' ? <input type="checkbox" checked={i.is_done} onChange={async () => { await repo.plans.updateItem(i.id, { is_done: !i.is_done }); bump(); }} style={{ width: 22, height: 22 }} /> : k === 'guest' ? <button type="button" onClick={async () => { const order = ['invited', 'yes', 'maybe', 'no']; await repo.plans.updateItem(i.id, { rsvp: order[(order.indexOf(i.rsvp) + 1) % 4] }); bump(); }}>{RSVP[i.rsvp] || '⏳'}</button> : k === 'booking' ? (i.is_done ? '✅' : '🎫') : k === 'itinerary' ? '📍' : '📝'}
                    title={i.title} done={k === 'checklist' && i.is_done}
                    sub={[i.on_date && fmtDay(i.on_date), i.ref_code, i.assignee_member_id && memberById(i.assignee_member_id)?.display_name, i.guest_count && t('plans.people', i.guest_count)].filter(Boolean).join(' · ')}
                    end={i.amount ? <span className="money">{formatMoney(i.amount, i.currency || cur)}</span> : null} />
                ))}
              </Card>
            );
          })}
          <form onSubmit={add} className="inline" style={{ flexWrap: 'nowrap' }}>
            <select className="select" style={{ width: 140 }} value={newKind} onChange={(e) => setNewKind(e.target.value)}>
              {turler.map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <input className="input" value={newItem} onChange={(e) => setNewItem(e.target.value)} placeholder="…" />
            <button className="btn">{t('common.add')}</button>
          </form>
        </>
      )}
      {sub === 'expense' && <ExpenseForm planId={plan.id} onDone={() => setSub('items')} />}
      {sub === 'task' && <TaskForm planId={plan.id} onDone={() => setSub('items')} />}
      {sub === 'contrib' && <Contributions t={t} plan={plan} repo={repo} tick={tick} bump={bump} cur={cur} baseCurrency={baseCurrency} rates={rates} />}
      {sub === 'edit' && <PlanForm t={t} plan={plan} onDone={onClose} />}
    </Sheet>
  );
}

/**
 * Plan formu. Yeni planda kategori ızgaradan gelir ve formdan değiştirilebilir;
 * düzenlemede kategori değiştirilmez (davranış — hedef/katkı, bant — ona bağlı).
 * "Harcaması olacak" kutusu kapalıysa bütçe alanı hiç görünmez.
 */
function PlanForm({ t, onDone, plan, categoryKey }) {
  const { repo, bump, baseCurrency } = useApp();
  const { locale } = useLocale();
  const editing = Boolean(plan);
  const [catKey, setCatKey] = useState(plan ? planCategory(plan).key : (categoryKey || 'visit'));
  const cat = planCategory(catKey);
  const isGoal = cat.kind === 'goal';
  const [title, setTitle] = useState(plan?.title || '');
  const [dest, setDest] = useState(plan?.destination || '');
  const [s, setS] = useState(plan?.starts_on || '');
  const [time, setTime] = useState(plan?.start_time ? String(plan.start_time).slice(0, 5) : '');
  const [e, setE] = useState(plan?.ends_on && plan.ends_on !== plan.starts_on ? plan.ends_on : '');
  const [notes, setNotes] = useState(plan?.description || '');
  const [status, setStatus] = useState(plan?.status || 'planned');
  const [money, setMoney] = useState(plan ? plan.has_money !== false : cat.money);
  const [liste, setListe] = useState(true);
  const [budget, setBudget] = useState(
    plan ? String((plan.kind === 'goal' ? plan.target_amount : plan.budget_amount) ?? '') : '');
  const [cur, setCur] = useState(plan?.budget_currency || baseCurrency);
  const [busy, setBusy] = useState(false);

  // Kategori değişince para varsayılanı da değişsin (kullanıcı henüz dokunmadıysa).
  const kategoriSec = (k) => { setCatKey(k); setMoney(planCategory(k).money); };

  const submit = async (ev) => {
    ev.preventDefault(); if (!title.trim() || busy) return;
    setBusy(true);
    try {
      const paraVar = isGoal || money;
      const minor = paraVar ? parseAmount(budget, cur) : null;
      const row = {
        title: title.trim(), destination: isGoal ? null : (dest.trim() || null),
        description: notes.trim() || null,
        starts_on: s || null, ends_on: (cat.multiDay && e) ? e : (s || null),
        start_time: time || null,
        has_money: paraVar,
        budget_amount: !isGoal && minor ? minorToDecimal(minor, cur) : null,
        target_amount: isGoal && minor ? minorToDecimal(minor, cur) : null,
        budget_currency: cur,
        // Tarihsiz yeni plan bir fikirdir; tarih girilince "planlandı".
        status: editing ? status : (s ? 'planned' : 'idea'),
      };
      if (editing) {
        await repo.plans.update(plan.id, row);
      } else {
        const yeni = await repo.plans.create({ ...row, kind: cat.kind, category: cat.key, icon: cat.emoji });
        if (liste && yeni?.id) {
          for (const [i, baslik] of categoryList(cat, locale).entries()) {
            await repo.plans.addItem({ plan_id: yeni.id, kind: 'checklist', title: baslik, sort_order: i });
          }
        }
      }
      bump(); onDone();
    } finally { setBusy(false); }
  };

  return (
    <form onSubmit={submit}>
      {!editing && (
        <Field label={t('plans.category')}>
          <select className="select" value={catKey} onChange={(x) => kategoriSec(x.target.value)}>
            {PLAN_CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.emoji} {categoryName(c, locale)}</option>)}
          </select>
        </Field>
      )}
      <Field label={t('calendar.titleField')}>
        <input className="input" autoFocus value={title} placeholder={categoryHint(cat, locale)} onChange={(x) => setTitle(x.target.value)} />
      </Field>
      <div className="grid-2">
        <Field label={isGoal ? t('calendar.start') : t('plans.date')}><input className="input" type="date" value={s} onChange={(x) => setS(x.target.value)} /></Field>
        {cat.multiDay
          ? <Field label={t('calendar.end')}><input className="input" type="date" value={e} min={s || undefined} onChange={(x) => setE(x.target.value)} /></Field>
          : <Field label={t('plans.time')}><input className="input" type="time" value={time} onChange={(x) => setTime(x.target.value)} /></Field>}
      </div>
      {!isGoal && (
        <Field label={t('plans.where')}><input className="input" value={dest} onChange={(x) => setDest(x.target.value)} /></Field>
      )}
      <Field label={t('plans.notes')}>
        <textarea className="input" rows={2} value={notes} onChange={(x) => setNotes(x.target.value)} />
      </Field>
      {!isGoal && (
        <label className="inline" style={{ marginBottom: 'var(--sp-3)' }}>
          <input type="checkbox" checked={money} onChange={(x) => setMoney(x.target.checked)} style={{ width: 22, height: 22 }} />
          {t('plans.hasMoney')}
        </label>
      )}
      {(isGoal || money) && (
        <div className="grid-2">
          <Field label={isGoal ? t('plans.target') : t('plans.budget')}><input className="input" inputMode="decimal" value={budget} onChange={(x) => setBudget(x.target.value)} /></Field>
          <Field label={t('money.currency')}><select className="select" value={cur} onChange={(x) => setCur(x.target.value)}>{CURRENCY_CODES.map((c) => <option key={c}>{c}</option>)}</select></Field>
        </div>
      )}
      {!editing && categoryList(cat, locale).length > 0 && (
        <label className="inline" style={{ marginBottom: 'var(--sp-3)', alignItems: 'flex-start' }}>
          <input type="checkbox" checked={liste} onChange={(x) => setListe(x.target.checked)} style={{ width: 22, height: 22 }} />
          <span>{t('plans.addList')}<br /><span className="faint">{categoryList(cat, locale).join(' · ')}</span></span>
        </label>
      )}
      {editing && (
        <Field label={t('plans.status')}>
          <select className="select" value={status} onChange={(x) => setStatus(x.target.value)}>
            {STATUSES.map((k) => <option key={k} value={k}>{t('plans.statuses.' + k)}</option>)}
          </select>
        </Field>
      )}
      {s && !isGoal && <div className="faint" style={{ marginBottom: 'var(--sp-3)' }}>🔔 {t('plans.remindNote')}</div>}
      <button className="btn btn--block" disabled={busy}>{t('common.save')}</button>
    </form>
  );
}

/**
 * Hedef katkıları. Hedefin ilerlemesi harcamadan değil katkılardan gelir;
 * katkı girmenin ekranda yolu yoktu, hedef hep %0 görünüyordu.
 * Kur katkı anında DB'de donduruluyor (0006) — buradan gönderilmiyor.
 */
function Contributions({ t, plan, repo, tick, bump, cur, baseCurrency, rates }) {
  const [rows, setRows] = useState(null);
  const [amount, setAmount] = useState('');
  const [ccy, setCcy] = useState(cur);
  const [date, setDate] = useState(today());
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => { repo.plans.contributions(plan.id).then(setRows); }, [repo, plan.id, tick]);

  const submit = async (ev) => {
    ev.preventDefault();
    const minor = parseAmount(amount, ccy);
    if (!minor) return;
    setBusy(true); setErr('');
    try {
      await repo.plans.addContribution({ plan_id: plan.id, amount: minorToDecimal(minor, ccy), currency: ccy, on_date: date, note: note || null });
      setAmount(''); setNote(''); bump();
    } catch (ex) { setErr(ex.message); } finally { setBusy(false); }
  };

  const target = Number(plan.target_amount || 0);
  const done = rows ? planTotals([], rows, baseCurrency, cur, rates).contributed : 0;

  return (
    <>
      {target > 0 && (
        <div className="stats" style={{ marginBottom: 'var(--sp-3)' }}>
          <div className="stat"><div className="stat__label">{t('plans.progress')}</div><div className="stat__value">{formatMoney(done, cur, { compact: true })}</div></div>
          <div className="stat"><div className="stat__label">{t('plans.target')}</div><div className="stat__value">{formatMoney(target, cur, { compact: true })}</div></div>
          <div className="stat"><div className="stat__label">{t('plans.remaining')}</div><div className="stat__value">{formatMoney(Math.max(0, target - done), cur, { compact: true })}</div></div>
        </div>
      )}
      <form onSubmit={submit}>
        <div className="grid-2">
          <Field label={t('money.amount')}><input className="input" inputMode="decimal" autoFocus value={amount} onChange={(x) => setAmount(x.target.value)} /></Field>
          <Field label={t('money.currency')}><select className="select" value={ccy} onChange={(x) => setCcy(x.target.value)}>{CURRENCY_CODES.map((c) => <option key={c}>{c}</option>)}</select></Field>
        </div>
        <div className="grid-2">
          <Field label={t('money.date')}><input className="input" type="date" value={date} onChange={(x) => setDate(x.target.value)} /></Field>
          <Field label={t('common.note')}><input className="input" value={note} onChange={(x) => setNote(x.target.value)} /></Field>
        </div>
        {err && <div className="banner" style={{ color: 'var(--color-danger)' }}>{err}</div>}
        <button className="btn btn--block" disabled={busy}>{t('plans.addContribution')}</button>
      </form>
      <div className="spacer" />
      {rows && rows.length > 0 && (
        <Card title={t('plans.contributions')} className="card--flat">
          {rows.map((c) => (
            <Row key={c.id} icon="🐖" title={formatMoney(c.amount, c.currency)}
              sub={[fmtDay(c.on_date), c.note].filter(Boolean).join(' · ')} />
          ))}
        </Card>
      )}
      {rows && rows.length === 0 && <Empty>{t('plans.noContributions')}</Empty>}
    </>
  );
}
