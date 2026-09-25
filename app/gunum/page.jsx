'use client';
// app/gunum/page.jsx — Günüm: kişisel gün planı ve hedefler.
//
// BU SAYFA ORTAK DEĞİL. Hanedeki diğer kişi buradaki blokları ve hedefleri
// göremez; sınır ekranda değil veritabanında, üye düzeyinde RLS ile kurulu
// (0021). Kullanıcının isteği buydu: "bu sayfanın ortak olmasına gerek yok,
// Carolina kendi disiplinini ayrı belirleyecek."
//
// İKİ SEKME: "Bugün" günü yaşamak için (dokun, işaretle), "Düzen" şablonu
// kurmak için. Bir ekranda hem yaşamak hem kurmak, telefonda ikisini de
// zorlaştırıyordu.
import { useCallback, useEffect, useState } from 'react';
import { useApp } from '../../components/AppShell.jsx';
import { Card, Row, Bar, Chips, Empty, Field } from '../../components/ui.jsx';
import { useT } from '../../lib/i18n/context.jsx';
import { today, fmtDayLong } from '../../lib/dates.js';

const SCOPES = ['weekday', 'weekend'];
const KINDS = ['daily', 'weekly', 'total'];

/** "HH:MM" → dakika. Yalnızca karşılaştırma için; saat aritmetiği yok. */
const dk = (hhmm) => {
  const [h, m] = String(hhmm || '').split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};

const kindKey = (k) => 'gunum.kind' + k[0].toUpperCase() + k.slice(1);

export default function MyDayPage() {
  const { repo, household, tick, bump } = useApp();
  const t = useT();
  const [tab, setTab] = useState('today');
  const [gun, setGun] = useState(null);
  const [hedefler, setHedefler] = useState([]);
  // Dakikada bir tazelenen "şimdi": saat ilerledikçe vurgulanan blok kaysın.
  const [simdi, setSimdi] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setSimdi(new Date()), 60000);
    return () => clearInterval(id);
  }, []);

  const yukle = useCallback(async () => {
    if (!household) return;
    const [d, g] = await Promise.all([repo.personal.day(), repo.personal.goals()]);
    setGun(d); setHedefler(g || []);
  }, [repo, household]);

  useEffect(() => { yukle(); }, [yukle, tick]);

  if (!gun) return <Empty>{t('common.loading')}</Empty>;

  const bloklar = gun.blocks || [];
  const su = simdi.getHours() * 60 + simdi.getMinutes();
  const aktif = bloklar.find((b) => dk(b.starts_at) <= su && su < dk(b.ends_at));
  const siradaki = bloklar.find((b) => dk(b.starts_at) > su);
  const yapilan = bloklar.filter((b) => b.done).length;

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="h1">{t('gunum.title')}</h1>
          <div className="page-head__sub">{fmtDayLong(today())}</div>
        </div>
        {gun.adherence7 !== null && gun.adherence7 !== undefined && (
          <span className="tag">{t('gunum.adherence', gun.adherence7)}</span>
        )}
      </div>

      <Chips value={tab} onChange={setTab}
        options={[{ value: 'today', label: t('gunum.tabToday') }, { value: 'setup', label: t('gunum.tabSetup') }]} />
      <div className="spacer" />

      {tab === 'today' && (
        <>
          <Card title={t('today.rhythm')} action={bloklar.length > 0
            ? <span className="faint">{t('gunum.blockDone', yapilan, bloklar.length)}</span> : null}>
            {bloklar.length === 0 && <Empty>{t('gunum.noBlocks')}</Empty>}
            {bloklar.map((b) => (
              <Row key={b.id}
                icon={<input type="checkbox" checked={b.done} style={{ width: 22, height: 22 }}
                  onChange={async () => { await repo.personal.toggleBlock(b.id); bump(); yukle(); }} />}
                title={`${b.icon || '•'} ${b.title}`}
                sub={`${String(b.starts_at).slice(0, 5)} – ${String(b.ends_at).slice(0, 5)}`}
                done={b.done}
                end={aktif && aktif.id === b.id ? <span className="tag tag--ok">{t('gunum.now')}</span>
                  : siradaki && siradaki.id === b.id ? <span className="faint">{t('gunum.next')}</span> : null} />
            ))}
          </Card>

          <Card title={t('gunum.goals')}>
            {hedefler.length === 0 && <Empty>{t('gunum.noGoals')}</Empty>}
            {hedefler.map((g) => <HedefSatiri key={g.id} g={g} repo={repo} t={t} yukle={yukle} bump={bump} />)}
          </Card>

          <p className="faint">{t('gunum.private')}</p>
        </>
      )}

      {tab === 'setup' && <Duzen repo={repo} t={t} yukle={yukle} bump={bump} />}
    </>
  );
}

/**
 * Bir hedef satırı. Kaydetme yolu türe göre değişiyor:
 * - 'weekly' bir EVET/HAYIR: o gün yaptın mı? Miktar sormak gereksiz sürtünme.
 * - 'daily' ve 'total' miktar ister; sık girilen değerler düğme olarak duruyor
 *   ki klavye açmadan tek dokunuşla girilebilsin.
 */
function HedefSatiri({ g, repo, t, yukle, bump }) {
  const [busy, setBusy] = useState(false);
  const yaz = async (miktar) => {
    if (busy) return;
    setBusy(true);
    try { await repo.personal.setGoal(g.id, miktar); bump(); await yukle(); } finally { setBusy(false); }
  };
  const adimlar = g.kind === 'total' ? [1, 2] : [10, 15, 30];
  const alt = g.kind === 'weekly'
    ? t('gunum.weekCount', g.progress, g.target)
    : g.kind === 'total'
      ? t('gunum.totalOf', g.progress, g.target, g.unit)
      : `${t('gunum.todayAmount')} ${g.today} / ${g.target} ${g.unit || ''}`.trim();

  return (
    <Row icon={g.icon || '🎯'} title={g.title} sub={alt}
      end={<span className="money">{t('common.pct', g.pct)}</span>}>
      <div style={{ marginTop: 6 }}><Bar pct={g.pct} /></div>
      <div className="inline" style={{ marginTop: 'var(--sp-2)' }}>
        {g.kind === 'weekly' ? (
          <button type="button" className={'btn btn--sm' + (Number(g.today) > 0 ? '' : ' btn--outline')}
            disabled={busy} onClick={() => yaz(Number(g.today) > 0 ? 0 : 1)}>
            {Number(g.today) > 0 ? t('gunum.undo') : t('gunum.didIt')}
          </button>
        ) : (
          <>
            {adimlar.map((n) => (
              <button key={n} type="button" className="btn btn--outline btn--sm" disabled={busy}
                onClick={() => yaz(Number(g.today || 0) + n)}>+{n}</button>
            ))}
            {Number(g.today) > 0 && (
              <button type="button" className="btn btn--ghost btn--sm" disabled={busy}
                onClick={() => yaz(0)}>{t('gunum.undo')}</button>
            )}
          </>
        )}
      </div>
    </Row>
  );
}

/** Şablon kurma: hafta içi / hafta sonu blokları ve hedefler. */
function Duzen({ repo, t, yukle, bump }) {
  const [scope, setScope] = useState('weekday');
  const [bloklar, setBloklar] = useState([]);
  const [hedefler, setHedefler] = useState([]);

  const tazele = useCallback(async () => {
    const [b, g] = await Promise.all([repo.personal.blocks(scope), repo.personal.goals()]);
    setBloklar(b || []); setHedefler(g || []);
  }, [repo, scope]);
  useEffect(() => { tazele(); }, [tazele]);

  const sonrasi = async () => { await tazele(); await yukle(); bump(); };

  return (
    <>
      <Card title={t('gunum.tabSetup')}>
        <Chips value={scope} onChange={setScope}
          options={SCOPES.map((s) => ({ value: s, label: t('gunum.' + s) }))} />
        <div className="spacer" />
        {bloklar.length === 0 && <Empty>{t('gunum.noBlocks')}</Empty>}
        {bloklar.map((b) => (
          <Row key={b.id} icon={b.icon || '•'} title={b.title}
            sub={`${String(b.starts_at).slice(0, 5)} – ${String(b.ends_at).slice(0, 5)}`}
            end={<button type="button" className="btn btn--ghost btn--sm"
              onClick={async () => { await repo.personal.removeBlock(b.id); sonrasi(); }}>{t('common.delete')}</button>} />
        ))}
        <div className="spacer" />
        <BlokFormu repo={repo} t={t} scope={scope} onDone={sonrasi} />
      </Card>

      <Card title={t('gunum.goals')}>
        {hedefler.length === 0 && <Empty>{t('gunum.noGoals')}</Empty>}
        {hedefler.map((g) => (
          <Row key={g.id} icon={g.icon || '🎯'} title={g.title}
            sub={`${t(kindKey(g.kind))} · ${g.target} ${g.unit || ''}`.trim()}
            end={<button type="button" className="btn btn--ghost btn--sm"
              onClick={async () => { await repo.personal.removeGoal(g.id); sonrasi(); }}>{t('common.delete')}</button>} />
        ))}
        <div className="spacer" />
        <HedefFormu repo={repo} t={t} onDone={sonrasi} />
      </Card>
    </>
  );
}

function BlokFormu({ repo, t, scope, onDone }) {
  const [title, setTitle] = useState('');
  const [icon, setIcon] = useState('');
  const [from, setFrom] = useState('09:00');
  const [to, setTo] = useState('12:00');
  const [busy, setBusy] = useState(false);

  const gonder = async (e) => {
    e.preventDefault();
    if (!title.trim() || busy) return;
    setBusy(true);
    try {
      await repo.personal.addBlock({ scope, title: title.trim(), icon: icon || null, starts_at: from, ends_at: to });
      setTitle(''); setIcon('');
      await onDone();
    } finally { setBusy(false); }
  };

  return (
    <form onSubmit={gonder}>
      <div className="grid-2">
        <Field label={t('gunum.blockTitle')}>
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} />
        </Field>
        <Field label="•">
          <input className="input" value={icon} maxLength={2} onChange={(e) => setIcon(e.target.value)} />
        </Field>
      </div>
      <div className="grid-2">
        <Field label={t('gunum.from')}>
          <input className="input" type="time" value={from} onChange={(e) => setFrom(e.target.value)} />
        </Field>
        <Field label={t('gunum.to')}>
          <input className="input" type="time" value={to} onChange={(e) => setTo(e.target.value)} />
        </Field>
      </div>
      <button className="btn btn--block" disabled={busy}>{t('gunum.addBlock')}</button>
    </form>
  );
}

function HedefFormu({ repo, t, onDone }) {
  const [title, setTitle] = useState('');
  const [icon, setIcon] = useState('');
  const [kind, setKind] = useState('daily');
  const [target, setTarget] = useState('30');
  const [unit, setUnit] = useState('');
  const [busy, setBusy] = useState(false);

  const gonder = async (e) => {
    e.preventDefault();
    const hedef = Number(target);
    if (!title.trim() || !hedef || hedef <= 0 || busy) return;
    setBusy(true);
    try {
      await repo.personal.addGoal({ title: title.trim(), icon: icon || null, kind, target: hedef, unit: unit || null });
      setTitle(''); setIcon(''); setUnit('');
      await onDone();
    } finally { setBusy(false); }
  };

  return (
    <form onSubmit={gonder}>
      <div className="grid-2">
        <Field label={t('gunum.goalTitle')}>
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} />
        </Field>
        <Field label="•">
          <input className="input" value={icon} maxLength={2} onChange={(e) => setIcon(e.target.value)} />
        </Field>
      </div>
      <Field label={t('gunum.kind')}>
        <select className="select" value={kind} onChange={(e) => setKind(e.target.value)}>
          {KINDS.map((k) => <option key={k} value={k}>{t(kindKey(k))}</option>)}
        </select>
      </Field>
      <div className="grid-2">
        <Field label={t('gunum.target')}>
          <input className="input" inputMode="numeric" value={target} onChange={(e) => setTarget(e.target.value)} />
        </Field>
        <Field label={t('gunum.unit')}>
          <input className="input" placeholder={t('gunum.unitHint')} value={unit} onChange={(e) => setUnit(e.target.value)} />
        </Field>
      </div>
      <button className="btn btn--block" disabled={busy}>{t('gunum.addGoal')}</button>
    </form>
  );
}
