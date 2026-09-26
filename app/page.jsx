'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useApp } from '../components/AppShell.jsx';
import { Card, Row, Money, Bar, Avatars, Empty, Sheet } from '../components/ui.jsx';
import { ShoppingForm } from '../components/QuickAdd.jsx';
import { useT } from '../lib/i18n/context.jsx';
import { today, periodOf, fmtDayLong, fmtTime, relativeLabel, weekDays, dowNames, fromISODate, fmtDay, nextOccurrence, daysBetween, dayInRange } from '../lib/dates.js';
import { formatMoney, budgetState, dailyAllowance } from '../lib/money.js';
import { holidayMap } from '../lib/holidays.js';
import GununKaresi from '../components/GununKaresi.jsx';
import BildirimAyarlari from '../components/BildirimAyarlari.jsx';
import { selamAnahtari } from '../lib/album.js';
import { SHOPPING_CATALOG, catalogName, normalizeName } from '../lib/shoppingCatalog.js';

export default function TodayPage() {
  const app = useApp();
  const { repo, me, members, tick, household, baseCurrency, memberById, bump, locale } = app;
  const t = useT();
  const [data, setData] = useState(null);
  // Tekrarlayan görev tamamlanınca vadesi ileri gider ve listeden kaybolur —
  // kullanıcı işaretlediğini teyit edemiyordu. Bu tur için ekranda tutulur.
  const [justDone, setJustDone] = useState([]);
  const [notifOpen, setNotifOpen] = useState(false);
  const [history, setHistory] = useState(false);
  // "Bitmiş olabilir" (0024) — listeye dönüşmeden, alışveriş satırında bir
  // hatırlatma olarak.
  const [bitti, setBitti] = useState([]);
  const T = today();

  useEffect(() => {
    if (!household || !repo.suggest) return undefined;
    let iptal = false;
    repo.suggest.restock().then((r) => { if (!iptal) setBitti(Array.isArray(r) ? r : []); }).catch(() => {});
    return () => { iptal = true; };
  }, [repo, household, tick]);

  useEffect(() => {
    if (!household) return;
    (async () => {
      // Altı ayrı istek yerine tek anlık görüntü + hafta şeridi (0004_bootstrap.sql).
      const period = periodOf(T);
      const [snap, weekEvents, plans] = await Promise.all([
        repo.summary.today(T, 7, period),
        repo.events.list({ from: weekDays(T)[0], to: weekDays(T)[6] }),
        repo.plans.list(),
      ]);
      setData({ ...snap, weekEvents, plans });
    })();
  }, [repo, household, tick, T]);

  if (!data) return <TodaySkeleton />;
  const { agenda, month, budget, shopping, notifs, weekEvents, plans } = data;
  const todays = agenda.events.filter((e) => e.date === T);
  const total = budget.find((b) => b.category_id === null);
  const bs = total ? budgetState(total.spent, total.budget) : null;
  const holidays = holidayMap(Number(T.slice(0, 4)), household.holiday_countries, locale);
  const openShopping = shopping.filter((s) => !s.is_checked);
  // Listede zaten olanı "bitmiş olabilir" diye ayrıca söyleme.
  const listede = new Set(openShopping.map((x) => normalizeName(x.name)));
  const bittiAdlari = bitti
    .map((b) => SHOPPING_CATALOG.find((x) => x.key === b.catalog_key))
    .filter(Boolean)
    .filter((x) => !listede.has(normalizeName(x.tr)) && !listede.has(normalizeName(x.es)))
    .map((x) => catalogName(x, locale));
  // Geciken işi bugünkü işle aynı kutuya koymak, gecikmeyi görünmez yapıyordu.
  const openTasks = agenda.tasks.filter((k) => !k.is_done);
  const overdueTasks = openTasks.filter((k) => k.due_on && k.due_on < T);
  const dueTodayTasks = openTasks.filter((k) => k.due_on === T);
  const undatedTasks = openTasks.filter((k) => !k.due_on);
  const todayTasks = [...overdueTasks, ...dueTodayTasks, ...undatedTasks];
  // Bugün bir seyahat/etkinlik sürüyorsa en üstte bağlam ver: "2. gün / 5".
  const activePlans = (plans || [])
    .filter((pl) => pl.kind !== 'goal' && pl.status !== 'cancelled')
    .map((pl) => ({ plan: pl, span: dayInRange(T, pl.starts_on, pl.ends_on) }))
    .filter((x) => x.span);
  const wd = weekDays(T);
  const DOW = dowNames();

  // İlk kullanım: hanede hiç veri yok. Beş tane boş kart göstermek yerine
  // ne yapılacağını söyleyen tek bir kart göster.
  const upcomingCount = agenda.documents.length + agenda.bills.length + agenda.occasions.length
    + agenda.events.filter((e) => e.date > T).length;
  const isFirstRun = weekEvents.length === 0 && upcomingCount === 0 && openTasks.length === 0
    && openShopping.length === 0 && month.expense === 0 && month.income === 0;

  return (
    <>
      {/* Başlık artık günün karesinin üstünde: selam saate göre değişiyor,
          tarih ve varsa bayram altında. */}
      <GununKaresi title={t(selamAnahtari(new Date().getHours()), me?.display_name || '')}
        sub={`${fmtDayLong(T)}${holidays[T] ? ` · 🎉 ${holidays[T][0].name}` : ''}`} />

      {/* Bu cihazda bildirim kapalıysa tek bir kart; açılınca ya da
          ertelenince bir daha görünmez. */}
      <BildirimAyarlari kompakt />

      {isFirstRun ? <StartCard onQuick={app.openQuick} /> : <>

      {/* BUGÜN — açınca ilk görülen şey: bugün ne var, ne yapılacak. */}
      <Card title={t('today.todayBlock')}>
        {activePlans.map(({ plan, span }) => (
          <Row key={plan.id} icon={plan.icon || '🧭'} title={plan.title}
            sub={`${t('plans.' + plan.kind)} · ${t('today.activePlan', span.day, span.total)}`}
            end={<Link className="faint" href="/planlar/">→</Link>} />
        ))}
        {todays.map((e) => (
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
        {dueTodayTasks.concat(undatedTasks).map((k) => (
          <TaskLine key={k.id} task={k} t={t} repo={repo} bump={bump} memberById={memberById}
            onDone={(id) => setJustDone((x) => [...x, id])} />
        ))}
        {justDone.length > 0 && justDone.map((id) => (
          <Row key={'done-' + id} icon="✓" title={t('today.doneJustNow')} done
            end={<button className="btn btn--ghost btn--sm" onClick={async () => {
              await repo.tasks.uncomplete(id);
              setJustDone((x) => x.filter((y) => y !== id));
              bump();
            }}>{t('today.undo')}</button>} />
        ))}
        {todays.length === 0 && dueTodayTasks.length === 0 && undatedTasks.length === 0 && justDone.length === 0 && activePlans.length === 0
          && <Empty>{t('today.nothingToday')}</Empty>}
      </Card>

      {/* BEKLEYEN İŞLER — gecikenler en üstte; boşken kart hiç çizilmez. */}
      {(overdueTasks.length > 0 || agenda.documents.length > 0 || agenda.bills.length > 0) && (
      <Card title={t('today.pending')} action={<span className="faint">{t('today.pendingCount', overdueTasks.length + agenda.documents.length + agenda.bills.length)}</span>}>
        {overdueTasks.map((k) => (
          <TaskLine key={k.id} task={k} t={t} repo={repo} bump={bump} memberById={memberById} overdueFrom={T}
            onDone={(id) => setJustDone((x) => [...x, id])} />
        ))}
        {agenda.documents.map((d) => (
          <Row key={d.id} icon="🪪" title={d.title} sub={d.daysLeft < 0 ? t('family.expired') : t('family.expiresIn', d.daysLeft)} end={<span className={'tag ' + (d.daysLeft <= 30 ? 'tag--danger' : 'tag--warn')}>{fmtDay(d.expires_on)}</span>} />
        ))}
        {agenda.bills.map((b) => (
          <Row key={b.id} icon="🧾" title={b.name} sub={relativeLabel(b.next_due_on)} end={<Money amount={b.amount} currency={b.currency} kind={b.kind} />} />
        ))}
      </Card>
      )}

      {history && <NotifHistory t={t} repo={repo} onClose={() => setHistory(false)} />}

      {/* SIRADAKİ 7 GÜN — bugünden sonrası. Belge ve vadeler Bekleyen'e taşındı. */}
      <Card title={t('today.next7')} action={<Link className="faint" href="/takvim/">{t('common.seeAll')} →</Link>}>
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
        <div className="spacer" />
        {agenda.events.filter((e) => e.date > T).slice(0, 5).map((e) => (
          <Row key={e.id + e.date} icon="📅" title={e.title} sub={`${relativeLabel(e.date)} · ${e.all_day ? t('calendar.allDay') : fmtTime(e.starts_at)}`} end={<Avatars members={(e.attendees || []).map(memberById).filter(Boolean)} />} />
        ))}
        {agenda.occasions.map((o) => (
          <Row key={o.id} icon={o.kind === 'birthday' ? '🎂' : '💍'} title={o.title} sub={relativeLabel(o.date) + (o.year && o.kind === 'birthday' ? ` · ${t('family.turns', Number(o.date.slice(0, 4)) - o.year)}` : '')} end={o.gift_ideas ? <span className="tag">🎁</span> : null} />
        ))}
      </Card>


      {/* Bildirimler katlı gelir: üç satır halinde tepeyi doldurup günün
          işlerini ekranın altına itiyordu. Vade ve belge uyarıları zaten
          bekleyen işler kartında görünüyor. */}
      {notifs.length > 0 && (
      <Card>
        <Row icon="🔔" title={t('today.notifCount', notifs.length)}
          onClick={() => setNotifOpen((x) => !x)}
          end={<span className="faint">{notifOpen ? '▲' : '▼'}</span>} />
        {notifOpen && (<>
          {notifs.map((n) => (
            <Row key={n.id} wrap title={n.title} sub={n.body}
              end={<button className="btn btn--ghost btn--sm" onClick={async () => { await repo.notifications.markRead(n.id); bump(); }}>✓</button>} />
          ))}
          <div className="inline" style={{ marginTop: 'var(--sp-2)' }}>
            <button className="btn btn--ghost btn--sm" onClick={() => setHistory(true)}>{t('today.allNotifs')}</button>
            <button className="btn btn--ghost btn--sm" onClick={async () => { await repo.notifications.markAllRead(); bump(); }}>{t('today.markAllRead')}</button>
          </div>
        </>)}
      </Card>
      )}

      {/* GÜNÜN RİTMİ + HEDEFLER — paranın yerine.
          Kullanıcının isteği: "bugün ekranında ne kadar harcadığımızı görmek
          istemiyorum." Bir günün özet ekranında aylık harcama toplamı zaten
          rapor parçasıydı; yeri Para ekranı.
          Yerine gelen şey o anki soruyu cevaplıyor: şu an ne yapıyor olmalıyım,
          sıradaki ne, ve bugünkü hedeflerim nerede. KİŞİSEL veriden beslenir;
          eşin kendi kartını görür (0021). */}
      <RitimKarti />


      {/* Alışveriş */}

      </>}

      {/* Alışveriş: LİSTE DEĞİL, BİLDİRİM.
          Bugün ekranı bir günün özeti olmalı; buraya alışveriş listesini de
          açmak ekranı iki işin karışımına çeviriyordu. Üstelik listeden kalem
          çıkarmanın yolu yoktu — deneme amaçlı yazılan bir şey ekranda
          kalıyordu. Liste artık tek yerde, Aile ekranının alışveriş
          sekmesinde; burada yalnızca bekleyen olduğunu söyleyen bir satır
          duruyor ve dokununca oraya gidiyor. */}
      {(openShopping.length > 0 || bittiAdlari.length > 0) && (
        <Card className="card--flat">
          <Row icon="🛒" title={openShopping.length > 0 ? t('today.shopping') : t('shopping.restockTitle')}
            sub={[
              openShopping.length > 0 ? t('today.itemsLeft', openShopping.length) : null,
              bittiAdlari.length > 0 ? t('shopping.restockHome', bittiAdlari.slice(0, 3).join(', ')) : null,
            ].filter(Boolean).join(' · ')}
            end={<span className="faint">→</span>}
            onClick={() => { window.location.href = '/aile/?sekme=shopping'; }} />
        </Card>
      )}
    </>
  );
}

/**
 * Bugün ekranındaki görev satırı.
 * Tekrarlayan görevde onay kutusu görevi bitirmez, vadeyi sonraki tekrara
 * taşır (0010) — bu yüzden satır listeden kaybolur ve üst bileşen "Yapıldı +
 * Geri al" satırını gösterir. Geciken görevde kaç gün geciktiği yazılır;
 * gecikmeyi bugünkü işle aynı görünüme sıkıştırmak onu görünmez yapıyordu.
 */
function TaskLine({ task: k, t, repo, bump, memberById, overdueFrom, onDone }) {
  const [busy, setBusy] = useState(false);
  const late = overdueFrom && k.due_on ? daysBetween(k.due_on, overdueFrom) : 0;
  const sub = [
    memberById(k.assignee_member_id)?.display_name,
    late > 1 ? t('today.overdue', late) : late === 1 ? t('today.overdueToday') : (k.due_on ? null : t('today.noDueDate')),
    k.rrule && '↻',
  ].filter(Boolean).join(' · ');

  return (
    <Row
      icon={<input type="checkbox" checked={false} disabled={busy}
        onChange={async () => {
          setBusy(true);
          try {
            const next = k.rrule && k.due_on ? nextOccurrence(k.rrule, k.due_on) : null;
            await repo.tasks.complete(k.id, next);
            onDone?.(k.id);
            bump();
          } finally { setBusy(false); }
        }} style={{ width: 22, height: 22 }} />}
      title={k.title} sub={sub || null}
      end={<>
        {late > 0 && <span className="tag tag--danger">!</span>}
        {k.points ? <span className="tag tag--ok">⭐ {k.points}</span> : null}
      </>} />
  );
}

/** Bildirim geçmişi: okunmuşlar dahil son 50 kayıt (sabah özetleri burada birikir). */
function NotifHistory({ t, repo, onClose }) {
  const [rows, setRows] = useState(null);
  useEffect(() => { repo.notifications.list({ all: true, limit: 50 }).then(setRows); }, [repo]);
  return (
    <Sheet onClose={onClose} title={t('common.notifications')}>
      {rows === null ? <Empty>{t('common.loading')}</Empty>
        : rows.length === 0 ? <Empty>{t('today.noNotifs')}</Empty>
        : rows.map((n) => (
          <Row key={n.id} wrap title={n.title} sub={[n.body, relativeLabel(String(n.fire_at).slice(0, 10))].filter(Boolean).join(' · ')}
            done={Boolean(n.read_at)} />
        ))}
    </Sheet>
  );
}

/** Hane bomboşken gösterilen tek yönlendirme kartı. */
function StartCard({ onQuick }) {
  const t = useT();
  return (
    <section className="start" style={{ marginBottom: 'var(--sp-3)' }}>
      <div className="start__title">{t('today.start.title')}</div>
      <p className="start__body">{t('today.start.body')}</p>
      <div className="start__list">
        <button type="button" className="start__item" onClick={onQuick}>
          <span className="start__num">1</span>{t('today.start.expense')}<span>→</span>
        </button>
        <Link className="start__item" href="/takvim/">
          <span className="start__num">2</span>{t('today.start.event')}<span>→</span>
        </Link>
        <Link className="start__item" href="/aile/">
          <span className="start__num">3</span>{t('today.start.family')}<span>→</span>
        </Link>
      </div>
    </section>
  );
}

// Veri gelene kadar boş ekran yerine kart iskeleti; ekran donmuş gibi görünmesin.
function TodaySkeleton() {
  return (
    <div aria-busy="true">
      {/* Günün karesi yer tutucusu: fotoğraf gelince sayfa zıplamasın. */}
      <div className="skel skel--card" style={{ aspectRatio: '16 / 10', maxHeight: 280 }} />
      {[96, 132, 120].map((h, i) => <div key={i} className="skel skel--card" style={{ height: h }} />)}
    </div>
  );
}

/**
 * Bugün ekranındaki tek satırlık kişisel kart.
 * Blok yoksa ve hedef yoksa HİÇ ÇİZİLMEZ: boş bir kart, kurulmamış bir
 * özelliği her gün hatırlatan bir sitem olurdu.
 */
function RitimKarti() {
  const { repo, household, tick } = useApp();
  const t = useT();
  const [gun, setGun] = useState(null);
  const [hedefler, setHedefler] = useState([]);
  const [takviye, setTakviye] = useState([]);

  useEffect(() => {
    if (!household) return undefined;
    let iptal = false;
    (async () => {
      try {
        const [d, g, sp] = await Promise.all([
          repo.personal.day(), repo.personal.goals(),
          repo.personal.supplements ? repo.personal.supplements() : null,
        ]);
        if (!iptal) { setGun(d); setHedefler(g || []); setTakviye(sp?.items || []); }
      } catch { /* kişisel veri okunamazsa Bugün'ün geri kalanı çalışmaya devam etsin */ }
    })();
    return () => { iptal = true; };
  }, [repo, household, tick]);

  const bloklar = gun?.blocks || [];
  // Hatırlatma: bugün alınmamış takviyeler. Hepsi alındıysa satır yok.
  const bekleyen = takviye.filter((x) => !x.done);
  if (bloklar.length === 0 && hedefler.length === 0 && bekleyen.length === 0) return null;

  const d = new Date();
  const su = d.getHours() * 60 + d.getMinutes();
  const dk = (x) => { const [h, m] = String(x || '').split(':').map(Number); return (h || 0) * 60 + (m || 0); };
  const aktif = bloklar.find((b) => dk(b.starts_at) <= su && su < dk(b.ends_at));
  const siradaki = bloklar.find((b) => dk(b.starts_at) > su);
  // Günün hedef ortalaması: tek sayı, çünkü Bugün'de yer dar.
  const ort = hedefler.length
    ? Math.round(hedefler.reduce((s2, g) => s2 + Number(g.pct || 0), 0) / hedefler.length)
    : null;

  return (
    <Card title={t('today.rhythm')} action={<Link className="faint" href="/gunum/">{t('nav.myday')} →</Link>}>
      {bloklar.length > 0 && (
        <Row icon={aktif ? (aktif.icon || '⏱️') : '⏱️'}
          title={aktif ? aktif.title : t('gunum.free')}
          sub={aktif
            ? `${String(aktif.starts_at).slice(0, 5)} – ${String(aktif.ends_at).slice(0, 5)}`
            : undefined}
          end={siradaki
            ? <span className="faint">{t('gunum.next')}: {String(siradaki.starts_at).slice(0, 5)}</span>
            : null} />
      )}
      {bekleyen.length > 0 && (
        <Row icon="💊" title={t('today.supplementsDue', bekleyen.length)}
          sub={bekleyen.slice(0, 3).map((x) => x.title).join(', ') + (bekleyen.length > 3 ? '…' : '')}
          end={<Link className="faint" href="/gunum/">→</Link>} />
      )}
      {ort !== null && (
        <>
          <div className="between" style={{ marginTop: 'var(--sp-2)' }}>
            <span className="muted">{t('gunum.goals')}</span>
            <span className="money">{t('common.pct', ort)}</span>
          </div>
          <div style={{ marginTop: 6 }}><Bar pct={ort} /></div>
        </>
      )}
    </Card>
  );
}
