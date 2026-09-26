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
import { Card, Row, Bar, Chips, Empty, Field, Sheet } from '../../components/ui.jsx';
import { useT, useLocale } from '../../lib/i18n/context.jsx';
import { today, fmtDayLong } from '../../lib/dates.js';
import SupplementPicker from '../../components/SupplementPicker.jsx';
import { supplementName } from '../../lib/supplementCatalog.js';
import {
  BLOCK_GROUPS, BLOCK_CATALOG, STARTER_DAY, GOAL_GROUPS, GOAL_CATALOG,
  itemName, goalUnit, findBlock, dakika, cakisiyor, sure,
} from '../../lib/gunCatalog.js';

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
  const [takviye, setTakviye] = useState(null);
  // Dakikada bir tazelenen "şimdi": saat ilerledikçe vurgulanan blok kaysın.
  const [simdi, setSimdi] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setSimdi(new Date()), 60000);
    return () => clearInterval(id);
  }, []);

  const yukle = useCallback(async () => {
    if (!household) return;
    const [d, g, s] = await Promise.all([
      repo.personal.day(), repo.personal.goals(), repo.personal.supplements(),
    ]);
    setGun(d); setHedefler(g || []); setTakviye(s || { items: [] });
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

          <TakviyeKarti veri={takviye} repo={repo} t={t} yukle={yukle} bump={bump} />

          <Card title={t('gunum.goals')}>
            {hedefler.length === 0 && <Empty>{t('gunum.noGoals')}</Empty>}
            {hedefler.map((g) => <HedefSatiri key={g.id} g={g} repo={repo} t={t} yukle={yukle} bump={bump} />)}
          </Card>

          <p className="faint">{t('gunum.private')}</p>
        </>
      )}

      {tab === 'setup' && <Duzen repo={repo} t={t} yukle={yukle} bump={bump} takviye={takviye} />}
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

/**
 * Düzen: günün akışı (zaman çizelgesi), hedefler, takviyeler.
 *
 * Eski hali düz bir liste artı boş bir formdu; kullanıcı "şekli hoşuma
 * gitmedi, kategorileştirirsen seçim kolaylaşır" dedi. Şimdi:
 *   • Bloklar takvimdeki olaylar gibi saat sütunu ve renkli çizgiyle diziliyor;
 *     aralardaki boşluk ve çakışma görünüyor.
 *   • Bloğa dokununca düzenleme paneli açılıyor (saat, ad, simge, sil).
 *   • "Blok ekle" bölümlere ayrılmış bir ızgara açıyor; seçince saatler hazır
 *     geliyor, onaylamadan bir şey eklenmiyor.
 */
function Duzen({ repo, t, yukle, bump, takviye }) {
  const { locale } = useLocale();
  const [scope, setScope] = useState('weekday');
  const [bloklar, setBloklar] = useState([]);
  const [hedefler, setHedefler] = useState([]);
  const [blokPanel, setBlokPanel] = useState(null);   // null | { blok? }
  const [hedefPanel, setHedefPanel] = useState(false);
  const [kuruluyor, setKuruluyor] = useState(false);

  const tazele = useCallback(async () => {
    const [b, g] = await Promise.all([repo.personal.blocks(scope), repo.personal.goals()]);
    setBloklar(b || []); setHedefler(g || []);
  }, [repo, scope]);
  useEffect(() => { tazele(); }, [tazele]);

  const sonrasi = async () => { await tazele(); await yukle(); bump(); };

  const ornekKur = async () => {
    if (kuruluyor) return;
    setKuruluyor(true);
    try {
      for (const key of STARTER_DAY[scope]) {
        const x = findBlock(key);
        if (x) await repo.personal.addBlock({ scope, title: itemName(x, locale), icon: x.emoji, starts_at: x.from, ends_at: x.to });
      }
      await sonrasi();
    } finally { setKuruluyor(false); }
  };

  const sirali = [...bloklar].sort((a, b) => dakika(a.starts_at) - dakika(b.starts_at));

  return (
    <>
      <Card title={t('gunum.flow')}
        action={<button type="button" className="btn btn--sm" onClick={() => setBlokPanel({})}>＋ {t('gunum.addShort')}</button>}>
        <Chips value={scope} onChange={setScope}
          options={SCOPES.map((s) => ({ value: s, label: t('gunum.' + s) }))} />
        <div className="spacer" />

        {sirali.length === 0 && (
          <div className="tl-empty">
            <div className="tl-empty__icon" aria-hidden="true">🗓️</div>
            <div className="faint">{t('gunum.starterHint')}</div>
            <button type="button" className="btn btn--block" disabled={kuruluyor} onClick={ornekKur}>
              ✨ {t('gunum.starterDay')}
            </button>
            <button type="button" className="btn btn--outline btn--block" onClick={() => setBlokPanel({})}>
              {t('gunum.addBlock')}
            </button>
          </div>
        )}

        <div className="tl-list">
          {sirali.map((b, i) => {
            const bas = hm(b.starts_at); const bit = hm(b.ends_at);
            const onceki = sirali[i - 1];
            const bosluk = onceki ? dakika(bas) - dakika(hm(onceki.ends_at)) : 0;
            const cakisan = sirali.find((o) => o.id !== b.id && cakisiyor(bas, bit, hm(o.starts_at), hm(o.ends_at)));
            return (
              <div key={b.id}>
                {bosluk >= 30 && (
                  <div className="tl-gap">{t('gunum.gap', sure(hm(onceki.ends_at), bas, locale))}</div>
                )}
                <div className="tl" data-g={blokGrubu(b)}>
                  <button type="button" className="tl__main" onClick={() => setBlokPanel({ blok: b })}
                    aria-label={`${b.title} ${bas}–${bit}`}>
                    <span className="tl__time"><b>{bas}</b><small>{bit}</small></span>
                    <span className="tl__bar" aria-hidden="true" />
                    <span className="tl__icon" aria-hidden="true">{b.icon || '•'}</span>
                    <span className="tl__body">
                      <span className="tl__title">{b.title}</span>
                      <span className="tl__sub">
                        {sure(bas, bit, locale)}
                        {cakisan && <span className="tl__warn"> · ⚠️ {t('gunum.overlap')}</span>}
                      </span>
                    </span>
                  </button>
                  {/* Bu blok başlarken bildirim gelsin mi (0026). */}
                  <button type="button" className="tl__bell" aria-pressed={b.notify !== false}
                    aria-label={t('notify.reminder')}
                    onClick={async () => { await repo.personal.updateBlock(b.id, { notify: b.notify === false }); sonrasi(); }}>
                    {b.notify === false ? '🔕' : '🔔'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
        {sirali.length > 0 && <div className="faint tl-hint">{t('gunum.editHint')}</div>}
      </Card>

      <Card title={t('gunum.goals')}
        action={<button type="button" className="btn btn--sm" onClick={() => setHedefPanel(true)}>＋ {t('gunum.addShort')}</button>}>
        {hedefler.length === 0 && <Empty>{t('gunum.noGoals')}</Empty>}
        {hedefler.map((g) => (
          <Row key={g.id} icon={g.icon || '🎯'} title={g.title}
            sub={`${t(kindKey(g.kind))} · ${g.target} ${g.unit || ''}`.trim()}
            end={<button type="button" className="btn btn--ghost btn--sm"
              onClick={async () => { await repo.personal.removeGoal(g.id); sonrasi(); }}>{t('common.delete')}</button>} />
        ))}
      </Card>

      <TakviyeDuzeni repo={repo} t={t} veri={takviye} onDone={sonrasi} />

      {blokPanel && (
        <BlokPaneli repo={repo} t={t} scope={scope} blok={blokPanel.blok} mevcut={sirali}
          onClose={() => setBlokPanel(null)}
          onDone={async () => { setBlokPanel(null); await sonrasi(); }} />
      )}
      {hedefPanel && (
        <HedefPaneli repo={repo} t={t} mevcut={hedefler}
          onClose={() => setHedefPanel(false)}
          onDone={async () => { setHedefPanel(false); await sonrasi(); }} />
      )}
    </>
  );
}

/** "07:00:00" → "07:00" */
const hm = (x) => String(x || '').slice(0, 5);

/** Blok hangi bölümden? Katalogdan simgesiyle bulunur; elle yazılanlar 'other'. */
const blokGrubu = (b) => BLOCK_CATALOG.find((x) => x.emoji === b.icon)?.group || 'other';

/**
 * Blok ekleme / düzenleme paneli.
 * Yeni blokta önce ızgara (bölüm → dokun), sonra saatleri hazır form.
 * Düzenlemede doğrudan form; altta sil.
 */
function BlokPaneli({ repo, t, scope, blok, mevcut, onClose, onDone }) {
  const { locale } = useLocale();
  const [adim, setAdim] = useState(blok ? 'form' : 'sec');
  const [grup, setGrup] = useState(BLOCK_GROUPS[0].key);
  const [title, setTitle] = useState(blok?.title || '');
  const [icon, setIcon] = useState(blok?.icon || '');
  const [from, setFrom] = useState(blok ? hm(blok.starts_at) : '09:00');
  const [to, setTo] = useState(blok ? hm(blok.ends_at) : '10:00');
  const [busy, setBusy] = useState(false);
  const [silOnay, setSilOnay] = useState(false);

  const secildi = (x) => {
    setTitle(itemName(x, locale)); setIcon(x.emoji); setFrom(x.from); setTo(x.to); setAdim('form');
  };
  const kendim = () => { setTitle(''); setIcon('⭐'); setAdim('form'); };

  const saatHatasi = dakika(to) <= dakika(from);
  const cakisan = mevcut.find((o) => o.id !== blok?.id && cakisiyor(from, to, hm(o.starts_at), hm(o.ends_at)));
  const ekli = new Set(mevcut.map((b) => b.title));

  const kaydet = async (e) => {
    e.preventDefault();
    if (!title.trim() || saatHatasi || busy) return;
    setBusy(true);
    try {
      const veri = { title: title.trim(), icon: icon.trim() || null, starts_at: from, ends_at: to };
      if (blok) await repo.personal.updateBlock(blok.id, veri);
      else await repo.personal.addBlock({ scope, ...veri });
      await onDone();
    } finally { setBusy(false); }
  };

  const sil = async () => {
    if (busy) return;
    setBusy(true);
    try { await repo.personal.removeBlock(blok.id); await onDone(); } finally { setBusy(false); }
  };

  return (
    <Sheet onClose={onClose} title={blok ? t('gunum.editBlock') : t('gunum.pickBlock')}>
      {adim === 'sec' && (
        <>
          <Chips value={grup} onChange={setGrup}
            options={BLOCK_GROUPS.map((g) => ({ value: g.key, label: `${g.emoji} ${itemName(g, locale)}` }))} />
          <div className="picker">
            {BLOCK_CATALOG.filter((x) => x.group === grup).map((x) => {
              const var_ = ekli.has(itemName(x, locale));
              return (
                <button key={x.key} type="button" className={'picker__item' + (var_ ? ' picker__item--on' : '')}
                  onClick={() => secildi(x)}>
                  <span className="picker__emoji" aria-hidden="true">{x.emoji}</span>
                  <span className="picker__name">{itemName(x, locale)}</span>
                  <span className="picker__sub">{x.from}–{x.to}</span>
                  {var_ && <span className="picker__tick" aria-hidden="true">✓</span>}
                </button>
              );
            })}
            <button type="button" className="picker__item" onClick={kendim}>
              <span className="picker__emoji" aria-hidden="true">✏️</span>
              <span className="picker__name">{t('gunum.custom')}</span>
            </button>
          </div>
        </>
      )}

      {adim === 'form' && (
        <form onSubmit={kaydet}>
          <div className="blok-onizleme">
            <span className="blok-onizleme__icon" aria-hidden="true">{icon || '•'}</span>
            <div>
              <div className="blok-onizleme__title">{title || t('gunum.blockTitle')}</div>
              <div className="faint">{from}–{to} · {saatHatasi ? '—' : sure(from, to, locale)}</div>
            </div>
          </div>
          <div className="grid-icon">
            <Field label={t('gunum.icon')}>
              <input className="input input--icon" value={icon} maxLength={8} onChange={(e) => setIcon(e.target.value)} />
            </Field>
            <Field label={t('gunum.blockTitle')}>
              <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} />
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
          {saatHatasi && <p className="form-err">{t('gunum.timeError')}</p>}
          {!saatHatasi && cakisan && (
            <p className="faint">⚠️ {t('gunum.overlapWith', cakisan.title)}</p>
          )}
          <button className="btn btn--block" disabled={busy || saatHatasi || !title.trim()}>
            {blok ? t('common.save') : t('gunum.addBlock')}
          </button>
          {!blok && (
            <button type="button" className="btn btn--ghost btn--block" onClick={() => setAdim('sec')}>
              ← {t('gunum.backToList')}
            </button>
          )}
          {blok && (silOnay ? (
            <div className="inline" style={{ marginTop: 'var(--sp-2)', justifyContent: 'center' }}>
              <button type="button" className="btn btn--danger btn--sm" disabled={busy} onClick={sil}>{t('common.yesDelete')}</button>
              <button type="button" className="btn btn--ghost btn--sm" onClick={() => setSilOnay(false)}>{t('common.cancel')}</button>
            </div>
          ) : (
            <button type="button" className="btn btn--ghost btn--block" onClick={() => setSilOnay(true)}>
              🗑️ {t('gunum.deleteBlock')}
            </button>
          ))}
        </form>
      )}
    </Sheet>
  );
}

/** Hedef ekleme paneli: bölüm → hazır hedef → tür/miktar hazır form. */
function HedefPaneli({ repo, t, mevcut, onClose, onDone }) {
  const { locale } = useLocale();
  const [adim, setAdim] = useState('sec');
  const [grup, setGrup] = useState(GOAL_GROUPS[0].key);
  const [title, setTitle] = useState('');
  const [icon, setIcon] = useState('🎯');
  const [kind, setKind] = useState('daily');
  const [target, setTarget] = useState('30');
  const [unit, setUnit] = useState('');
  const [busy, setBusy] = useState(false);

  const ekli = new Set(mevcut.map((g) => g.title));
  const secildi = (x) => {
    setTitle(itemName(x, locale)); setIcon(x.emoji); setKind(x.kind);
    setTarget(String(x.target)); setUnit(goalUnit(x, locale)); setAdim('form');
  };
  const kendim = () => { setTitle(''); setIcon('🎯'); setKind('daily'); setTarget('30'); setUnit(''); setAdim('form'); };

  const kaydet = async (e) => {
    e.preventDefault();
    const hedef = Number(target);
    if (!title.trim() || !hedef || hedef <= 0 || busy) return;
    setBusy(true);
    try {
      await repo.personal.addGoal({ title: title.trim(), icon: icon.trim() || null, kind, target: hedef, unit: unit.trim() || null });
      await onDone();
    } finally { setBusy(false); }
  };

  return (
    <Sheet onClose={onClose} title={t('gunum.pickGoal')}>
      {adim === 'sec' && (
        <>
          <Chips value={grup} onChange={setGrup}
            options={GOAL_GROUPS.map((g) => ({ value: g.key, label: `${g.emoji} ${itemName(g, locale)}` }))} />
          <div className="picker">
            {GOAL_CATALOG.filter((x) => x.group === grup).map((x) => {
              const var_ = ekli.has(itemName(x, locale));
              return (
                <button key={x.key} type="button"
                  className={'picker__item' + (var_ ? ' picker__item--done' : '')}
                  disabled={var_} onClick={() => secildi(x)}>
                  <span className="picker__emoji" aria-hidden="true">{x.emoji}</span>
                  <span className="picker__name">{itemName(x, locale)}</span>
                  <span className="picker__sub">{x.target} {goalUnit(x, locale)}</span>
                  {var_ && <span className="picker__tick" aria-hidden="true">✓</span>}
                </button>
              );
            })}
            <button type="button" className="picker__item" onClick={kendim}>
              <span className="picker__emoji" aria-hidden="true">✏️</span>
              <span className="picker__name">{t('gunum.custom')}</span>
            </button>
          </div>
        </>
      )}
      {adim === 'form' && (
        <form onSubmit={kaydet}>
          <div className="grid-icon">
            <Field label={t('gunum.icon')}>
              <input className="input input--icon" value={icon} maxLength={8} onChange={(e) => setIcon(e.target.value)} />
            </Field>
            <Field label={t('gunum.goalTitle')}>
              <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} />
            </Field>
          </div>
          <Field label={t('gunum.kind')}>
            <Chips value={kind} onChange={setKind} options={KINDS.map((k) => ({ value: k, label: t(kindKey(k)) }))} />
          </Field>
          <div className="grid-2">
            <Field label={t('gunum.target')}>
              <input className="input" inputMode="numeric" value={target} onChange={(e) => setTarget(e.target.value)} />
            </Field>
            <Field label={t('gunum.unit')}>
              <input className="input" placeholder={t('gunum.unitHint')} value={unit} onChange={(e) => setUnit(e.target.value)} />
            </Field>
          </div>
          <button className="btn btn--block" disabled={busy || !title.trim()}>{t('gunum.addGoal')}</button>
          <button type="button" className="btn btn--ghost btn--block" onClick={() => setAdim('sec')}>
            ← {t('gunum.backToList')}
          </button>
        </form>
      )}
    </Sheet>
  );
}

/**
 * Bugün: takviye işaretleme.
 *
 * TEK DOKUNUŞ = BİR DOZ. Günde iki kez alınan bir şeyde iki dokunuş gerekir;
 * onay kutusu kullanmadım çünkü "yarısını aldım" onay kutusuyla anlatılamaz.
 * Yanlış dokunuşun geri dönüşü var: satıra basılı kalan "−" düğmesi.
 *
 * HİÇ TAKVİYE YOKSA KART HİÇ ÇİZİLMİYOR. Kullanmayan biri için boş bir kart,
 * her gün bakılan ekranda gereksiz gürültü.
 */
function TakviyeKarti({ veri, repo, t, yukle, bump }) {
  const [busy, setBusy] = useState(null);
  const items = veri?.items || [];
  if (items.length === 0) return null;

  const dokun = async (s, delta) => {
    if (busy) return;
    setBusy(s.id);
    try { await repo.personal.takeSupplement(s.id, delta); bump(); await yukle(); } finally { setBusy(null); }
  };

  const kalan = items.filter((s) => !s.done).length;

  return (
    <Card title={t('gunum.supplements')}
      action={<span className={kalan ? 'faint' : 'tag tag--ok'}>
        {kalan ? t('gunum.supplementsLeft', kalan) : t('gunum.supplementsAllDone')}
      </span>}>
      {items.map((s) => (
        <Row key={s.id} icon={s.icon || '💊'} title={s.title}
          sub={[s.dose, s.per_day > 1 ? t('gunum.perDayTimes', s.per_day) : null].filter(Boolean).join(' · ')}
          done={s.done}
          end={<span className="faint">{t('gunum.takenOf', s.taken, s.per_day)}</span>}>
          <div className="inline" style={{ marginTop: 'var(--sp-2)' }}>
            <button type="button" className={'btn btn--sm' + (s.done ? ' btn--outline' : '')}
              disabled={busy === s.id || s.done} onClick={() => dokun(s, 1)}>
              {s.done ? '✓' : t('gunum.took')}
            </button>
            {s.taken > 0 && (
              <button type="button" className="btn btn--ghost btn--sm"
                disabled={busy === s.id} onClick={() => dokun(s, -1)}>−</button>
            )}
          </div>
        </Row>
      ))}
    </Card>
  );
}

/** Düzen: takviye listesini kurmak. Izgaradan seç ya da elle yaz. */
function TakviyeDuzeni({ repo, t, veri, onDone }) {
  const { locale } = useLocale();
  const [busyKey, setBusyKey] = useState(null);
  const items = veri?.items || [];

  const ekle = async (item) => {
    setBusyKey(item.key);
    try {
      await repo.personal.addSupplement({
        catalog_key: item.key, title: supplementName(item, locale),
        icon: item.emoji, dose: item.dose || null, per_day: 1,
      });
      await onDone();
    } finally { setBusyKey(null); }
  };

  return (
    <Card title={t('gunum.supplements')}>
      {items.length === 0 && <Empty>{t('gunum.noSupplements')}</Empty>}
      {items.map((s) => (
        <Row key={s.id} icon={s.icon || '💊'} title={s.title}
          sub={[s.dose, s.per_day > 1 ? t('gunum.perDayTimes', s.per_day) : null].filter(Boolean).join(' · ')}
          end={<button type="button" className="btn btn--ghost btn--sm"
            onClick={async () => { await repo.personal.removeSupplement(s.id); onDone(); }}>{t('common.delete')}</button>} />
      ))}
      <div className="spacer" />
      <SupplementPicker mevcut={items} onPick={ekle} busyKey={busyKey} />
      <div className="spacer" />
      <TakviyeFormu repo={repo} t={t} onDone={onDone} />
    </Card>
  );
}

/** Katalogda olmayan takviye için yazarak ekleme. Izgaranın yerine değil, yanında. */
function TakviyeFormu({ repo, t, onDone }) {
  const [title, setTitle] = useState('');
  const [dose, setDose] = useState('');
  const [perDay, setPerDay] = useState('1');
  const [busy, setBusy] = useState(false);

  const gonder = async (e) => {
    e.preventDefault();
    if (!title.trim() || busy) return;
    setBusy(true);
    try {
      await repo.personal.addSupplement({
        title: title.trim(), icon: '💊', dose: dose.trim() || null,
        per_day: Math.min(6, Math.max(1, Number(perDay) || 1)),
      });
      setTitle(''); setDose(''); setPerDay('1');
      await onDone();
    } finally { setBusy(false); }
  };

  return (
    <form onSubmit={gonder}>
      <Field label={t('gunum.supplementTitle')}>
        <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} />
      </Field>
      <div className="grid-2">
        <Field label={t('gunum.dose')}>
          <input className="input" placeholder={t('gunum.doseHint')} value={dose}
            onChange={(e) => setDose(e.target.value)} />
        </Field>
        <Field label={t('gunum.perDay')}>
          <select className="select" value={perDay} onChange={(e) => setPerDay(e.target.value)}>
            {[1, 2, 3, 4].map((n) => <option key={n} value={String(n)}>{n}</option>)}
          </select>
        </Field>
      </div>
      <button className="btn btn--block" disabled={busy}>{t('gunum.addSupplement')}</button>
    </form>
  );
}
