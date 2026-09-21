'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useApp } from '../components/AppShell.jsx';
import { Card, Row, Money, Bar, Avatars, Empty } from '../components/ui.jsx';
import { ShoppingForm } from '../components/QuickAdd.jsx';
import { useT } from '../lib/i18n/context.jsx';
import { today, periodOf, fmtDayLong, fmtTime, relativeLabel, weekDays, dowNames, fromISODate, fmtDay } from '../lib/dates.js';
import { formatMoney, budgetState, dailyAllowance } from '../lib/money.js';
import { holidayMap } from '../lib/holidays.js';

export default function TodayPage() {
  const app = useApp();
  const { repo, me, members, tick, household, baseCurrency, memberById, bump, locale } = app;
  const t = useT();
  const [data, setData] = useState(null);
  const T = today();

  useEffect(() => {
    if (!household) return;
    (async () => {
      const period = periodOf(T);
      const [agenda, month, budget, shopping, notifs, weekEvents] = await Promise.all([
        repo.summary.agenda(T, 7), repo.summary.month(period), repo.summary.budgetStatus(period),
        repo.shopping.items(), repo.notifications.list(), repo.events.list({ from: weekDays(T)[0], to: weekDays(T)[6] }),
      ]);
      setData({ agenda, month, budget, shopping, notifs, weekEvents });
    })();
  }, [repo, household, tick, T]);

  if (!data) return <Empty>{t('common.loading')}</Empty>;
  const { agenda, month, budget, shopping, notifs, weekEvents } = data;
  const todays = agenda.events.filter((e) => e.date === T);
  const total = budget.find((b) => b.category_id === null);
  const bs = total ? budgetState(total.spent, total.budget) : null;
  const holidays = holidayMap(Number(T.slice(0, 4)), household.holiday_countries, locale);
  const openShopping = shopping.filter((s) => !s.is_checked);
  const todayTasks = agenda.tasks.filter((k) => !k.due_on || k.due_on <= T);
  const wd = weekDays(T);
  const DOW = dowNames();

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="h1">{t('today.greeting', me?.display_name || '')}</h1>
          <div className="page-head__sub">{fmtDayLong(T)}{holidays[T] ? ` · 🎉 ${holidays[T][0].name}` : ''}</div>
        </div>
        <Avatars members={members} />
      </div>

      {notifs.length > 0 && (
        <Card title={`🔔 ${t('common.notifications')}`}>
          {notifs.map((n) => (
            <Row key={n.id} wrap title={n.title} sub={n.body} end={<button className="btn btn--ghost btn--sm" onClick={async () => { await repo.notifications.markRead(n.id); bump(); }}>✓</button>} />
          ))}
        </Card>
      )}

      {/* Hafta şeridi */}
      <Card title={t('today.week')} action={<Link className="faint" href="/takvim/">{t('common.seeAll')} →</Link>}>
        <div className="week-strip">
          {wd.map((d, i) => {
            const evs = weekEvents.filter((e) => e.date === d);
            const colors = [...new Set(evs.flatMap((e) => e.attendees || []).map((id) => memberById(id)?.color).filter(Boolean))].slice(0, 4);
            return (
              <Link href={`/takvim/?d=${d}`} key={d} className={'day-cell' + (d === T ? ' day-cell--today' : '') + (holidays[d] ? ' day-cell--holiday' : '')}>
                <div className="day-cell__dow">{DOW[i]}</div>
                <div className="day-cell__num">{fromISODate(d).getDate()}</div>
                <div className="day-cell__dots">{colors.map((c) => <span key={c} className="dot" style={{ background: c }} />)}{evs.length > 4 && <span className="faint">+</span>}</div>
              </Link>
            );
          })}
        </div>
      </Card>

      {/* Bugünün ajandası */}
      <Card title={t('today.agenda')}>
        {todays.length === 0 ? <Empty>{t('today.noEvents')}</Empty> : todays.map((e) => (
          <div className="event" key={e.id + e.date}>
            <div className="event__time">{e.all_day ? t('calendar.allDay') : fmtTime(e.starts_at)}</div>
            <div className="event__bar" style={{ background: memberById(e.attendees?.[0])?.color || 'var(--color-brand)' }} />
            <div style={{ flex: 1 }}>
              <div className="event__title">{e.title}</div>
              <div className="event__meta">{t('calendar.categories.' + e.category)}{e.location ? ` · ${e.location}` : ''}</div>
            </div>
            <Avatars members={(e.attendees || []).map(memberById).filter(Boolean)} />
          </div>
        ))}
      </Card>

      {/* Para nabzı */}
      <Card title={t('today.moneyPulse')} action={<Link className="faint" href="/para/">{t('nav.money')} →</Link>} className="card--brand">
        <div className="between" style={{ alignItems: 'flex-end' }}>
          <div>
            <div className="faint">{t('today.spentThisMonth')}</div>
            <div style={{ fontSize: 'var(--fs-2xl)', fontWeight: 700 }}>{formatMoney(month.expense, baseCurrency)}</div>
          </div>
          {total && (
            <div style={{ textAlign: 'right' }}>
              <div className="faint">{t('today.budgetLeft')}</div>
              <div style={{ fontSize: 'var(--fs-lg)', fontWeight: 700 }}>{formatMoney(total.remaining, baseCurrency)}</div>
              <div className="faint">{formatMoney(dailyAllowance(total.remaining), baseCurrency)} / {t('today.perDay')}</div>
            </div>
          )}
        </div>
        {bs && <div style={{ margin: 'var(--sp-3) 0 var(--sp-2)' }}><Bar pct={bs.pct} state={bs.state} /></div>}
        <div className="faint" style={{ marginBottom: 'var(--sp-2)' }}>{t('today.top3')}</div>
        <div className="inline">
          {month.by_category.slice(0, 3).map((c) => (
            <span key={c.category_id} className="tag" style={{ background: 'rgba(255,255,255,.18)', color: 'inherit' }}>{c.icon} {c.name} · {formatMoney(c.total, baseCurrency, { compact: true })}</span>
          ))}
        </div>
      </Card>

      {/* Yaklaşanlar */}
      <Card title={t('today.upcoming')}>
        {agenda.documents.map((d) => (
          <Row key={d.id} icon="🪪" title={d.title} sub={d.daysLeft < 0 ? t('family.expired') : t('family.expiresIn', d.daysLeft)} end={<span className={'tag ' + (d.daysLeft <= 30 ? 'tag--danger' : 'tag--warn')}>{fmtDay(d.expires_on)}</span>} />
        ))}
        {agenda.bills.map((b) => (
          <Row key={b.id} icon="🧾" title={b.name} sub={relativeLabel(b.next_due_on)} end={<Money amount={b.amount} currency={b.currency} kind={b.kind} />} />
        ))}
        {agenda.occasions.map((o) => (
          <Row key={o.id} icon={o.kind === 'birthday' ? '🎂' : '💍'} title={o.title} sub={relativeLabel(o.date) + (o.year && o.kind === 'birthday' ? ` · ${t('family.turns', Number(o.date.slice(0, 4)) - o.year)}` : '')} end={o.gift_ideas ? <span className="tag">🎁</span> : null} />
        ))}
        {agenda.events.filter((e) => e.date > T).slice(0, 4).map((e) => (
          <Row key={e.id + e.date} icon="📅" title={e.title} sub={`${relativeLabel(e.date)} · ${e.all_day ? t('calendar.allDay') : fmtTime(e.starts_at)}`} end={<Avatars members={(e.attendees || []).map(memberById).filter(Boolean)} />} />
        ))}
        {!agenda.documents.length && !agenda.bills.length && !agenda.occasions.length && <Empty>{t('common.empty')}</Empty>}
      </Card>

      {/* Görevler */}
      <Card title={t('today.tasksDue')} action={<Link className="faint" href="/aile/?tab=tasks">{t('common.seeAll')} →</Link>}>
        {todayTasks.length === 0 ? <Empty>{t('common.empty')}</Empty> : todayTasks.map((k) => (
          <Row key={k.id} icon={<input type="checkbox" checked={k.is_done} onChange={async () => { await repo.tasks.toggle(k.id); bump(); }} style={{ width: 22, height: 22 }} />}
            title={k.title} sub={memberById(k.assignee_member_id)?.display_name} done={k.is_done}
            end={k.points ? <span className="tag tag--ok">⭐ {k.points}</span> : null} />
        ))}
      </Card>

      {/* Alışveriş */}
      <Card title={`🛒 ${t('today.shopping')}`} action={<span className="faint">{t('today.itemsLeft', openShopping.length)}</span>}>
        {openShopping.slice(0, 6).map((s) => (
          <Row key={s.id} icon={<input type="checkbox" checked={false} onChange={async () => { await repo.shopping.toggleItem(s.id); bump(); }} style={{ width: 22, height: 22 }} />} title={s.name} sub={memberById(s.added_by_member_id)?.display_name} />
        ))}
        <div className="spacer" />
        <ShoppingForm />
      </Card>
    </>
  );
}
