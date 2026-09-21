'use client';
import { useEffect, useMemo, useState } from 'react';
import { useApp } from '../../components/AppShell.jsx';
import { Card, Seg, Chips, Avatars, Empty, Sheet, Row } from '../../components/ui.jsx';
import { EventForm, repeatKeyOf } from '../../components/QuickAdd.jsx';
import { useT } from '../../lib/i18n/context.jsx';
import { today, weekDays, monthGrid, addDays, addMonths, periodOf, fmtPeriod, fmtDayLong, fmtTime, dowNames, fromISODate, overlaps } from '../../lib/dates.js';
import { holidayMap } from '../../lib/holidays.js';

export default function CalendarPage() {
  const { repo, members, memberById, household, tick, bump, locale } = useApp();
  const t = useT();
  const [view, setView] = useState('week');
  const [sel, setSel] = useState(today());
  const [filter, setFilter] = useState('all');
  const [events, setEvents] = useState([]);
  const [adding, setAdding] = useState(false);
  const [open, setOpen] = useState(null);
  const [editing, setEditing] = useState(false);      // açık olay düzenleme kipinde mi
  const [confirming, setConfirming] = useState(false); // silme onayı bekliyor mu
  const T = today();

  useEffect(() => { try { const d = new URLSearchParams(window.location.search).get('d'); if (d) setSel(d); } catch { /* */ } }, []);

  const range = useMemo(() => {
    if (view === 'month') { const g = monthGrid(periodOf(sel)); return { from: g[0], to: g[41] }; }
    if (view === 'agenda') return { from: sel, to: addDays(sel, 30) };
    const w = weekDays(sel); return { from: w[0], to: w[6] };
  }, [view, sel]);

  useEffect(() => { if (household) repo.events.list(range).then(setEvents); }, [repo, household, range, tick]);

  const holidays = holidayMap(Number(sel.slice(0, 4)), household?.holiday_countries, locale);
  const visible = events.filter((e) => filter === 'all' || (e.attendees || []).includes(filter));
  const byDay = (d) => visible.filter((e) => e.date === d);
  const colorOf = (e) => e.color || memberById(e.attendees?.[0])?.color || 'var(--color-brand)';
  const DOW = dowNames();

  // Çakışma tespiti: aynı üye, aynı gün, örtüşen saat
  const conflicts = useMemo(() => {
    const set = new Set();
    for (const a of visible) for (const b of visible) {
      if (a === b || a.date !== b.date || a.all_day || b.all_day) continue;
      const shared = (a.attendees || []).some((m) => (b.attendees || []).includes(m));
      if (shared && overlaps(a.starts_at, a.ends_at, b.starts_at, b.ends_at)) { set.add(a.id + a.date); set.add(b.id + b.date); }
    }
    return set;
  }, [visible]);

  const nav = (n) => setSel(view === 'month' ? addMonths(sel, n) : view === 'agenda' ? addDays(sel, 30 * n) : addDays(sel, 7 * n));

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="h1">{t('calendar.title')}</h1>
          <div className="page-head__sub">{view === 'month' ? fmtPeriod(periodOf(sel)) : fmtDayLong(sel)}</div>
        </div>
        <Seg value={view} onChange={setView} options={[{ value: 'week', label: t('calendar.week') }, { value: 'month', label: t('calendar.month') }, { value: 'agenda', label: t('calendar.agenda') }]} />
      </div>

      <div className="between" style={{ marginBottom: 'var(--sp-3)' }}>
        <button className="btn btn--ghost btn--sm" onClick={() => nav(-1)}>‹</button>
        <Chips value={filter} onChange={setFilter} options={[{ value: 'all', label: t('common.all') }, ...members.map((m) => ({ value: m.id, label: `${m.avatar_emoji} ${m.display_name}` }))]} />
        <button className="btn btn--ghost btn--sm" onClick={() => nav(1)}>›</button>
      </div>

      {view === 'week' && (
        <>
          <Card>
            <div className="week-strip">
              {weekDays(sel).map((d, i) => {
                const evs = byDay(d);
                const colors = [...new Set(evs.map(colorOf))].slice(0, 4);
                return (
                  <button key={d} className={'day-cell' + (d === T ? ' day-cell--today' : '') + (d === sel ? ' day-cell--selected' : '') + (holidays[d] ? ' day-cell--holiday' : '')} onClick={() => setSel(d)}>
                    <div className="day-cell__dow">{DOW[i]}</div>
                    <div className="day-cell__num">{fromISODate(d).getDate()}</div>
                    <div className="day-cell__dots">{colors.map((c) => <span key={c} className="dot" style={{ background: c }} />)}</div>
                  </button>
                );
              })}
            </div>
          </Card>
          <DayList t={t} day={sel} events={byDay(sel)} holidays={holidays} memberById={memberById} conflicts={conflicts} colorOf={colorOf} onOpen={setOpen} />
        </>
      )}

      {view === 'month' && (
        <Card>
          <div className="month-grid">
            {DOW.map((d) => <div key={d} className="month-grid__dow">{d}</div>)}
            {monthGrid(periodOf(sel)).map((d) => {
              const evs = byDay(d);
              return (
                <button key={d} className={'month-cell' + (periodOf(d) !== periodOf(sel) ? ' month-cell--out' : '') + (d === T ? ' month-cell--today' : '')} onClick={() => { setSel(d); setView('week'); }} style={{ textAlign: 'left' }}>
                  <span className="month-cell__num" style={holidays[d] ? { color: 'var(--color-expense)' } : undefined}>{fromISODate(d).getDate()}</span>
                  {evs.slice(0, 2).map((e) => <span key={e.id + e.date} className="month-cell__pill" style={{ background: colorOf(e) }}>{e.title}</span>)}
                  {evs.length > 2 && <span className="faint" style={{ fontSize: 10 }}>+{evs.length - 2}</span>}
                </button>
              );
            })}
          </div>
        </Card>
      )}

      {view === 'agenda' && (
        [...new Set(visible.map((e) => e.date))].map((d) => (
          <DayList key={d} t={t} day={d} events={byDay(d)} holidays={holidays} memberById={memberById} conflicts={conflicts} colorOf={colorOf} onOpen={setOpen} compact />
        ))
      )}
      {view === 'agenda' && visible.length === 0 && <Empty>{t('common.empty')}</Empty>}

      <button className="btn btn--outline btn--block" onClick={() => setAdding(true)}>+ {t('calendar.newEvent')}</button>

      {adding && <Sheet onClose={() => setAdding(false)} title={t('calendar.newEvent')}><EventForm date0={sel} onDone={() => setAdding(false)} /></Sheet>}
      {open && (
        <Sheet onClose={() => { setOpen(null); setEditing(false); setConfirming(false); }} title={editing ? t('calendar.editEvent') : open.title}>
          {editing ? (
            <EventForm event={open} onDone={() => { setOpen(null); setEditing(false); }} />
          ) : (
            <>
              <Row icon="🕒" title={open.all_day ? t('calendar.allDay') : `${fmtTime(open.starts_at)} – ${fmtTime(open.ends_at)}`} sub={fmtDayLong(open.date)} />
              <Row icon="🏷️" title={t('calendar.categories.' + open.category)}
                   sub={open.rrule ? `${t('calendar.repeat')}: ${t('calendar.repeats.' + repeatKeyOf(open.rrule))}` : null} />
              {open.location && <Row icon="📍" title={open.location} />}
              <Row icon="👥" title={<Avatars members={(open.attendees || []).map(memberById).filter(Boolean)} size="md" />} />
              {open.description && <p className="muted" style={{ padding: 'var(--sp-3) 0' }}>{open.description}</p>}
              <div className="spacer" />
              <button className="btn btn--block" onClick={() => setEditing(true)}>{t('common.edit')}</button>
              <div className="spacer" />
              {confirming ? (
                <>
                  <div className="faint" style={{ marginBottom: 'var(--sp-2)' }}>{t('common.confirmDelete', open.title)}</div>
                  <div className="grid-2">
                    <button className="btn btn--ghost" onClick={() => setConfirming(false)}>{t('common.cancel')}</button>
                    <button className="btn btn--danger" onClick={async () => { await repo.events.remove(open.id); setOpen(null); setConfirming(false); bump(); }}>{t('common.yesDelete')}</button>
                  </div>
                </>
              ) : (
                <button className="btn btn--danger btn--block" onClick={() => setConfirming(true)}>{t('common.delete')}</button>
              )}
            </>
          )}
        </Sheet>
      )}
    </>
  );
}

function DayList({ t, day, events, holidays, memberById, conflicts, colorOf, onOpen, compact }) {
  return (
    <Card title={compact ? fmtDayLong(day) : undefined}>
      {holidays[day] && holidays[day].map((h) => (
        <div className="event" key={h.key}>
          <div className="event__time">🎉</div>
          <div className="event__bar" style={{ background: 'var(--color-expense)' }} />
          <div><div className="event__title">{h.name}</div><div className="event__meta">{t('calendar.holiday')} · {h.country === 'CL' ? '🇨🇱' : '🇹🇷'} {t('countries.' + h.country)}</div></div>
        </div>
      ))}
      {events.length === 0 && !holidays[day] && <Empty>{t('today.noEvents')}</Empty>}
      {events.map((e) => (
        <div className="event" key={e.id + e.date} onClick={() => onOpen(e)} style={{ cursor: 'pointer' }}>
          <div className="event__time">{e.all_day ? t('calendar.allDay') : fmtTime(e.starts_at)}<br /><span className="faint">{e.all_day ? '' : fmtTime(e.ends_at)}</span></div>
          <div className="event__bar" style={{ background: colorOf(e) }} />
          <div style={{ flex: 1 }}>
            <div className="event__title">{e.title} {conflicts.has(e.id + e.date) && <span className="tag tag--danger" title={t('calendar.conflict')}>⚠︎</span>}</div>
            <div className="event__meta">{t('calendar.categories.' + e.category)}{e.location ? ` · ${e.location}` : ''}{e.rrule ? ' · ↻' : ''}</div>
          </div>
          <Avatars members={(e.attendees || []).map(memberById).filter(Boolean)} />
        </div>
      ))}
    </Card>
  );
}
