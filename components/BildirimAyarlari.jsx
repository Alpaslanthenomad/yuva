'use client';
import { useEffect, useState } from 'react';
import { useApp } from './AppShell.jsx';
import { Card, Row } from './ui.jsx';
import { useT } from '../lib/i18n/context.jsx';
import { pushDurumu, cihazBilgisi, bildirimleriAc, bildirimleriKapat } from '../lib/push.js';

const GEC_ANAHTAR = 'yuva:bildirim:sonra';
const LEADS = [0, 10, 30, 60, 120, 1440];

/**
 * Telefona bildirim — açma düğmesi ve tercihler.
 *
 * İKİ BİÇİM
 *  • kompakt (Bugün ekranında): yalnızca bu cihazda bildirim KAPALIYKEN
 *    görünen tek kart. Açılınca ya da "Şimdi değil" denince kaybolur.
 *  • tam (Ayarlar): durum, aç/kapat, neyin ne zaman hatırlatılacağı, deneme.
 *
 * İzin penceresi yalnızca kullanıcının dokunuşuyla açılabilir (tarayıcı
 * kuralı); bu yüzden sayfa açılır açılmaz izin istenmiyor.
 */
/**
 * Pazar akşamı gelecek özetin şimdiki hali — "ne gelecek?" sorusunu
 * bildirimi beklemeden cevaplamak için (0030).
 */
function HaftalikOnizleme({ t, repo }) {
  const [ozet, setOzet] = useState(undefined);
  const [busy, setBusy] = useState(false);
  const bak = async () => {
    setBusy(true);
    try { setOzet(await repo.push.weeklyPreview()); } catch { setOzet(null); } finally { setBusy(false); }
  };
  return (
    <div style={{ margin: 'var(--sp-2) 0 var(--sp-3)' }}>
      <button type="button" className="btn btn--ghost btn--sm" disabled={busy} onClick={bak}>👁️ {t('notify.weeklyPreview')}</button>
      {ozet !== undefined && (
        <div className="ozet-onizleme">
          {ozet ? (<><b>{ozet.title}</b>{(ozet.parts || []).map((x) => <div key={x}>{x}</div>)}</>)
            : <span className="faint">{t('notify.weeklyEmpty')}</span>}
        </div>
      )}
    </div>
  );
}

export default function BildirimAyarlari({ kompakt = false }) {
  const { repo } = useApp();
  const t = useT();
  const [cihaz, setCihaz] = useState(null);
  const [prefs, setPrefs] = useState(null);
  const [busy, setBusy] = useState(false);
  const [mesaj, setMesaj] = useState(null);
  const [gecildi, setGecildi] = useState(false);

  const tazele = async () => {
    setCihaz(await cihazBilgisi());
    try { setPrefs(await repo.push.prefs()); } catch { setPrefs(null); }
  };
  useEffect(() => {
    tazele();
    try { setGecildi(localStorage.getItem(GEC_ANAHTAR) === '1'); } catch { /* */ }
  }, [repo]);   // eslint-disable-line react-hooks/exhaustive-deps

  if (!cihaz || !repo.push) return null;
  const durum = repo.push.demo ? 'demo' : pushDurumu(cihaz);

  const ac = async () => {
    setBusy(true); setMesaj(null);
    try {
      const sonuc = await bildirimleriAc(repo);
      setMesaj(sonuc === 'granted' ? t('notify.enabled') : t('notify.deniedNow'));
    } catch { setMesaj(t('notify.error')); }
    finally { setBusy(false); tazele(); }
  };
  const kapat = async () => {
    setBusy(true); setMesaj(null);
    try { await bildirimleriKapat(repo); } finally { setBusy(false); tazele(); }
  };
  const dene = async () => {
    setBusy(true); setMesaj(null);
    try {
      const n = await repo.push.test(t('notify.testTitle'), t('notify.testBody'));
      setMesaj(n > 0 ? t('notify.testSent') : t('notify.noDevice'));
    } catch { setMesaj(t('notify.error')); }
    finally { setBusy(false); }
  };
  const yaz = async (patch) => {
    setPrefs((p) => ({ ...p, ...patch }));
    try { await repo.push.setPrefs(patch); } catch { tazele(); }
  };

  // ---- Bugün ekranındaki tek kart -------------------------------------------
  if (kompakt) {
    if (gecildi || !['off', 'ios-install'].includes(durum)) return null;
    return (
      <Card className="card--flat">
        <Row icon="🔔" wrap title={t('notify.promptTitle')}
          sub={durum === 'ios-install' ? t('notify.iosInstall') : t('notify.promptBody')} />
        <div className="inline" style={{ marginTop: 'var(--sp-2)' }}>
          {durum === 'off' && <button type="button" className="btn btn--sm" disabled={busy} onClick={ac}>{t('notify.enable')}</button>}
          <button type="button" className="btn btn--ghost btn--sm" onClick={() => {
            setGecildi(true); try { localStorage.setItem(GEC_ANAHTAR, '1'); } catch { /* */ }
          }}>{t('notify.later')}</button>
        </div>
        {mesaj && <div className="faint" style={{ marginTop: 'var(--sp-2)' }}>{mesaj}</div>}
      </Card>
    );
  }

  // ---- Ayarlar -------------------------------------------------------------
  const acik = durum === 'on';
  const Anahtar = ({ k, label, children }) => (
    <div className="bildirim-satir">
      <label className="inline" style={{ flex: 1 }}>
        <input type="checkbox" checked={Boolean(prefs?.[k])} disabled={!prefs} onChange={(e) => yaz({ [k]: e.target.checked })}
          style={{ width: 22, height: 22 }} />
        {label}
      </label>
      {children}
    </div>
  );

  return (
    <Card title={`🔔 ${t('notify.title')}`}>
      <div className="faint" style={{ marginBottom: 'var(--sp-3)' }}>{t('notify.status.' + durum)}</div>
      {durum === 'off' && <button type="button" className="btn btn--block" disabled={busy} onClick={ac}>{t('notify.enable')}</button>}
      {acik && (
        <div className="grid-2" style={{ marginBottom: 'var(--sp-3)' }}>
          <button type="button" className="btn btn--outline" disabled={busy} onClick={dene}>{t('notify.test')}</button>
          <button type="button" className="btn btn--ghost" disabled={busy} onClick={kapat}>{t('notify.disable')}</button>
        </div>
      )}
      {mesaj && <div className="banner" style={{ background: 'var(--color-brand-soft)', color: 'var(--color-brand-ink)' }}>{mesaj}</div>}

      {prefs && durum !== 'demo' && (
        <>
          <div className="oneri__baslik" style={{ marginTop: 'var(--sp-3)' }}>{t('notify.what')}</div>
          <Anahtar k="events" label={t('notify.events')}>
            <select className="select" style={{ width: 130 }} value={prefs.event_lead_min} disabled={!prefs.events}
              onChange={(e) => yaz({ event_lead_min: Number(e.target.value) })}>
              {LEADS.map((n) => <option key={n} value={n}>{t('notify.lead.' + n)}</option>)}
            </select>
          </Anahtar>
          <Anahtar k="plans" label={t('notify.plans')} />
          <Anahtar k="blocks" label={t('notify.blocks')} />
          <Anahtar k="supplements" label={t('notify.supplements')}>
            <input className="input" type="time" style={{ width: 110 }} value={String(prefs.supplements_at || '09:00').slice(0, 5)}
              disabled={!prefs.supplements} onChange={(e) => e.target.value && yaz({ supplements_at: e.target.value })} />
          </Anahtar>
          <Anahtar k="goals" label={t('notify.goals')}>
            <input className="input" type="time" style={{ width: 110 }} value={String(prefs.goals_at || '20:30').slice(0, 5)}
              disabled={!prefs.goals} onChange={(e) => e.target.value && yaz({ goals_at: e.target.value })} />
          </Anahtar>
          <Anahtar k="occasions" label={t('notify.occasions')} />
          <Anahtar k="digest" label={t('notify.digest')} />
          <Anahtar k="weekly" label={t('notify.weekly')}>
            <select className="select" style={{ width: 110 }} value={String(prefs.weekly_at || '19:00').slice(0, 5)}
              disabled={!prefs.weekly} onChange={(e) => yaz({ weekly_at: e.target.value })}>
              {['17:00', '18:00', '19:00', '20:00', '21:00'].map((h) => <option key={h} value={h}>{h}</option>)}
            </select>
          </Anahtar>
          <HaftalikOnizleme t={t} repo={repo} />
          <div className="faint" style={{ marginTop: 'var(--sp-2)' }}>{t('notify.privateNote')}</div>
        </>
      )}
    </Card>
  );
}
