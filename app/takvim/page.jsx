'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useApp } from '../../components/AppShell.jsx';
import { Card, Seg, Chips, Avatars, Empty, Sheet, Row } from '../../components/ui.jsx';
import { EventForm } from '../../components/QuickAdd.jsx';
import { useT } from '../../lib/i18n/context.jsx';
import { today, weekDays, monthGrid, addDays, addMonths, periodOf, fmtPeriod, fmtDayLong, fmtTime, dowNames, monthNames, fromISODate, overlaps, dayInRange, freqKeyOf } from '../../lib/dates.js';
import { holidayMap } from '../../lib/holidays.js';

/** Hafta görünümünün başlığı: iki gün numarası ve ay adı. */
function haftaEtiketi(sel) {
  const w = weekDays(sel);
  const a = fromISODate(w[0]); const b = fromISODate(w[6]);
  const ay = (d) => monthNames()[d.getMonth()];
  return a.getMonth() === b.getMonth()
    ? `${a.getDate()} – ${b.getDate()} ${ay(b)}`
    : `${a.getDate()} ${ay(a)} – ${b.getDate()} ${ay(b)}`;
}

export default function CalendarPage() {
  const { repo, members, memberById, household, tick, bump, locale } = useApp();
  const t = useT();
  // Görünüm cihazda hatırlanıyor: ayı açık bırakan, ertesi gün de ayı görsün.
  const [view, setViewRaw] = useState('week');
  useEffect(() => {
    try { const v = localStorage.getItem('yuva:takvim:gorunum'); if (['week', 'month', 'agenda'].includes(v)) setViewRaw(v); } catch { /* */ }
  }, []);
  const setView = (v) => { setViewRaw(v); try { localStorage.setItem('yuva:takvim:gorunum', v); } catch { /* */ } };
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
  // Planlar takvimde bant olarak görünür. Kopya olay YAZMIYORUZ: plan tarihleri
  // değişince takvimde eski kayıt kalırdı. Tek kaynak plans tablosu.
  const [plans, setPlans] = useState([]);
  useEffect(() => { if (household) repo.plans.list().then(setPlans); }, [repo, household, tick]);
  // Birikim hedefi (goal) bant olarak gösterilmez: aralığı bir birikim ufku,
  // o gün süren bir şey değil — her güne düşüp takvimi kirletiyordu.
  const plansOn = (d) => plans
    .filter((pl) => pl.kind !== 'goal' && pl.status !== 'cancelled')
    .map((pl) => ({ plan: pl, span: dayInRange(d, pl.starts_on, pl.ends_on) }))
    .filter((x) => x.span);

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
        <h1 className="h1">{t('calendar.title')}</h1>
        <Seg value={view} onChange={setView} options={[{ value: 'week', label: t('calendar.week') }, { value: 'month', label: t('calendar.month') }, { value: 'agenda', label: t('calendar.agenda') }]} />
      </div>

      {/* Dönem başlığı okların ARASINDA: hangi ayda/haftada olduğun ve nasıl
          ileri-geri gidileceği tek satırda. Önceden oklar üye filtresinin iki
          yanındaydı ve filtreyi kaydıran bir şey gibi görünüyordu. */}
      <div className="cal-nav">
        <button type="button" className="btn btn--ghost btn--sm" onClick={() => nav(-1)} aria-label="‹">‹</button>
        <button type="button" className="cal-nav__label" onClick={() => setSel(T)}>
          {view === 'month' ? fmtPeriod(periodOf(sel)) : view === 'agenda' ? fmtDayLong(sel) : haftaEtiketi(sel)}
          {sel !== T && <span className="faint"> · {t('calendar.backToday')}</span>}
        </button>
        <button type="button" className="btn btn--ghost btn--sm" onClick={() => nav(1)} aria-label="›">›</button>
      </div>
      <div style={{ marginBottom: 'var(--sp-3)' }}>
        <Chips value={filter} onChange={setFilter} options={[{ value: 'all', label: t('common.all') }, ...members.map((m) => ({ value: m.id, label: `${m.avatar_emoji} ${m.display_name}` }))]} />
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
            <button type="button" className="cal-expand" onClick={() => setView('month')}>⌄ {t('calendar.showMonth')}</button>
          </Card>
          <DayList t={t} day={sel} events={byDay(sel)} holidays={holidays} memberById={memberById} conflicts={conflicts} colorOf={colorOf} onOpen={setOpen} plans={plansOn(sel)} />
        </>
      )}

      {/* AY: güne dokunmak artık haftaya ATMIYOR; o günün listesi hemen
          altta açılıyor. Kullanıcı yalnızca bir haftayı görebildiğini
          söylüyordu — ay görünümü vardı ama bir güne dokununca haftaya geri
          dönüyordu, yani ayda kalmanın yolu yoktu. Hücrelerde yazı yerine
          renkli nokta: 390 px'lik ekranda yedi sütuna sığan tek şey bu. */}
      {view === 'month' && (
        <>
          <Card>
            <div className="month-grid">
              {DOW.map((d) => <div key={d} className="month-grid__dow">{d}</div>)}
              {monthGrid(periodOf(sel)).map((d) => {
                const evs = byDay(d);
                const colors = [...new Set(evs.map(colorOf))].slice(0, 3);
                const planli = plansOn(d)[0]?.plan;
                return (
                  <button type="button" key={d}
                    className={'month-cell' + (periodOf(d) !== periodOf(sel) ? ' month-cell--out' : '') + (d === T ? ' month-cell--today' : '') + (d === sel ? ' month-cell--selected' : '') + (holidays[d] ? ' month-cell--holiday' : '')}
                    onClick={() => setSel(d)} aria-pressed={d === sel}>
                    <span className="month-cell__num">{fromISODate(d).getDate()}</span>
                    <span className="month-cell__dots">
                      {colors.map((c) => <span key={c} className="dot" style={{ background: c }} />)}
                      {evs.length > 3 && <span className="month-cell__more">+</span>}
                    </span>
                    {planli && <span className="month-cell__plan" title={planli.title}>{planli.icon || '🧭'}</span>}
                  </button>
                );
              })}
            </div>
            <button type="button" className="cal-expand" onClick={() => setView('week')}>⌃ {t('calendar.showWeek')}</button>
          </Card>
          <DayList t={t} day={sel} events={byDay(sel)} holidays={holidays} memberById={memberById} conflicts={conflicts} colorOf={colorOf} onOpen={setOpen} plans={plansOn(sel)} title={fmtDayLong(sel)} />
        </>
      )}

      {view === 'agenda' && (
        [...new Set(visible.map((e) => e.date))].map((d) => (
          <DayList key={d} t={t} day={d} events={byDay(d)} holidays={holidays} memberById={memberById} conflicts={conflicts} colorOf={colorOf} onOpen={setOpen} plans={plansOn(d)} compact />
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
                   sub={open.rrule ? `${t('calendar.repeat')}: ${t('calendar.repeats.' + freqKeyOf(open.rrule))}` : null} />
              {open.location && <Row icon="📍" title={open.location} />}
              <Row icon="👥" title={<Avatars members={(open.attendees || []).map(memberById).filter(Boolean)} size="md" />} />
              {open.description && <p className="muted" style={{ padding: 'var(--sp-3) 0' }}>{open.description}</p>}
              <div className="spacer" />
              <button className="btn btn--block" onClick={() => setEditing(true)}>{t('common.edit')}</button>
              <div className="spacer" />
              {confirming ? (
                <>
                  <div className="faint" style={{ marginBottom: 'var(--sp-2)' }}>{t('common.confirmDelete', open.title)}</div>
                  {/* Tekrarlayan olayda tek günü atlamak seriyi silmez, o tarihi exdates'e yazar (0008). */}
                  {open.rrule ? (
                    <>
                      <div className="grid-2">
                        <button className="btn btn--danger" onClick={async () => { await repo.events.skipOccurrence(open.id, open.date); setOpen(null); setConfirming(false); bump(); }}>{t('calendar.deleteThisOne')}</button>
                        <button className="btn btn--danger" onClick={async () => { await repo.events.remove(open.id); setOpen(null); setConfirming(false); bump(); }}>{t('calendar.deleteSeries')}</button>
                      </div>
                      <div className="faint" style={{ marginTop: 'var(--sp-2)' }}>{t('calendar.skippedHint')}</div>
                      <div className="spacer" />
                      <button className="btn btn--ghost btn--block" onClick={() => setConfirming(false)}>{t('common.cancel')}</button>
                    </>
                  ) : (
                    <div className="grid-2">
                      <button className="btn btn--ghost" onClick={() => setConfirming(false)}>{t('common.cancel')}</button>
                      <button className="btn btn--danger" onClick={async () => { await repo.events.remove(open.id); setOpen(null); setConfirming(false); bump(); }}>{t('common.yesDelete')}</button>
                    </div>
                  )}
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

function DayList({ t, day, events, holidays, memberById, conflicts, colorOf, onOpen, compact, plans = [], title }) {
  return (
    <Card title={title || (compact ? fmtDayLong(day) : undefined)}>
      {/* Plan bandı en üstte: o gün bir seyahat veya etkinlik sürüyorsa bağlamı verir. */}
      {plans.map(({ plan, span }) => (
        <Link className="event" key={plan.id} href="/planlar/" style={{ textDecoration: 'none', color: 'inherit' }}>
          <div className="event__time">{plan.icon || '🧭'}</div>
          <div className="event__bar" style={{ background: plan.color || 'var(--color-brand)' }} />
          <div style={{ flex: 1 }}>
            <div className="event__title">{plan.title}</div>
            <div className="event__meta">{plan.start_time ? String(plan.start_time).slice(0, 5) + ' · ' : ''}{plan.destination || t('plans.' + plan.kind)}{span.total > 1 ? ` · ${t('today.activePlan', span.day, span.total)}` : ''}</div>
          </div>
        </Link>
      ))}
      {holidays[day] && holidays[day].map((h) => (
        <div className="event" key={h.key}>
          <div className="event__time">🎉</div>
          <div className="event__bar" style={{ background: 'var(--color-expense)' }} />
          <div><div className="event__title">{h.name}</div><div className="event__meta">{t('calendar.holiday')} · {h.country === 'CL' ? '🇨🇱' : '🇹🇷'} {t('countries.' + h.country)}</div></div>
        </div>
      ))}
      {events.length === 0 && !holidays[day] && plans.length === 0 && <Empty>{t('today.noEvents')}</Empty>}
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
