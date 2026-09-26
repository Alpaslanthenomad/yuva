'use client';
// components/FisAlani.jsx — harcamaya fiş fotoğrafı (0031).
//
// Harcama kaydedildikten sonra (onay ekranında) ve düzenlerken görünür.
// Telefonda "fotoğraf çek" ya da "galeriden seç" iOS/Android'in kendi
// menüsüyle geliyor. Fotoğraf yüklenmeden önce küçültülüyor ve konum
// bilgisi siliniyor; eşin kişisel harcamasının fişi ona görünmez.
import { useEffect, useRef, useState } from 'react';
import { useApp } from './AppShell.jsx';
import { useT } from '../lib/i18n/context.jsx';

export default function FisAlani({ txn, onChange }) {
  const { repo, bump } = useApp();
  const t = useT();
  const [path, setPath] = useState(txn?.receipt_path || null);
  const [url, setUrl] = useState(null);
  const [busy, setBusy] = useState(false);
  const [hata, setHata] = useState('');
  const [buyuk, setBuyuk] = useState(false);
  const [silOnay, setSilOnay] = useState(false);
  const input = useRef(null);

  useEffect(() => {
    let iptal = false;
    setUrl(null);
    if (path && repo.receipts) repo.receipts.url(path).then((u) => { if (!iptal) setUrl(u); }).catch(() => {});
    return () => { iptal = true; };
  }, [path, repo]);

  if (!txn?.id || !repo.receipts) return null;

  const sec = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setBusy(true); setHata('');
    try {
      const yeni = await repo.receipts.attach(txn.id, file, path);
      setPath(yeni); bump(); onChange?.(yeni);
    } catch (ex) {
      setHata(String(ex?.message || '').includes('demo-fis-full') ? t('receipt.demoFull') : t('receipt.error'));
    } finally { setBusy(false); }
  };

  const kaldir = async () => {
    setBusy(true); setHata('');
    try { await repo.receipts.remove(txn.id, path); setPath(null); setSilOnay(false); bump(); onChange?.(null); }
    catch { setHata(t('receipt.error')); }
    finally { setBusy(false); }
  };

  return (
    <div className="fis">
      <input ref={input} type="file" accept="image/*" hidden onChange={sec} />
      {path ? (
        <div className="fis__var">
          <button type="button" className="fis__kucuk" onClick={() => url && setBuyuk(true)} aria-label={t('receipt.open')}>
            {url ? <img src={url} alt="" /> : <span aria-hidden="true">🧾</span>}
          </button>
          <div className="fis__metin">
            <b>🧾 {t('receipt.attached')}</b>
            <div className="inline">
              <button type="button" className="btn btn--ghost btn--sm" disabled={busy} onClick={() => input.current?.click()}>
                {t('receipt.replace')}
              </button>
              {silOnay ? (
                <button type="button" className="btn btn--danger btn--sm" disabled={busy} onClick={kaldir}>{t('common.yesDelete')}</button>
              ) : (
                <button type="button" className="btn btn--ghost btn--sm" disabled={busy} onClick={() => setSilOnay(true)}>
                  {t('receipt.remove')}
                </button>
              )}
            </div>
          </div>
        </div>
      ) : (
        <button type="button" className="btn btn--outline btn--block" disabled={busy} onClick={() => input.current?.click()}>
          📷 {busy ? t('receipt.uploading') : t('receipt.add')}
        </button>
      )}
      {busy && path && <div className="faint">{t('receipt.uploading')}</div>}
      {hata && <div className="banner banner--danger" style={{ marginTop: 'var(--sp-2)' }}>{hata}</div>}
      {buyuk && url && (
        <div className="lightbox" role="dialog" aria-modal="true" onClick={() => setBuyuk(false)}>
          <img src={url} alt="" />
        </div>
      )}
    </div>
  );
}
