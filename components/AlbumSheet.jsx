'use client';
import { useEffect, useRef, useState } from 'react';
import { useApp } from './AppShell.jsx';
import { Sheet, Empty } from './ui.jsx';
import { useT } from '../lib/i18n/context.jsx';

/**
 * Aile albümü: fotoğraf ekle / sil. Albüm HANEYE ait; iki eş de ekleyebilir,
 * Bugün ekranında ikisi de aynı günün karesini görür.
 *
 * - Birden çok fotoğraf tek seferde seçilebilir; sırayla yükleniyor ki
 *   yavaş bağlantıda telefon donmasın ve hangisinin kaldığı görülsün.
 * - Silmek iki dokunuş: ilki "Sil?" sorar. Albüm ortak; yanlışlıkla eşin
 *   eklediği fotoğrafı tek dokunuşla kaybetmek kötü olurdu.
 */
export default function AlbumSheet({ onClose }) {
  const { repo, bump } = useApp();
  const t = useT();
  const [rows, setRows] = useState(null);
  const [ilerleme, setIlerleme] = useState(null);   // {i, n}
  const [hata, setHata] = useState(null);
  const [soru, setSoru] = useState(null);           // silinmek üzere olan id
  const giris = useRef(null);

  const yukle = async () => { try { setRows(await repo.album.list()); } catch { setRows([]); } };
  useEffect(() => { yukle(); }, [repo]);   // eslint-disable-line react-hooks/exhaustive-deps

  const sec = async (e) => {
    const dosyalar = [...(e.target.files || [])];
    e.target.value = '';
    if (!dosyalar.length) return;
    setHata(null);
    for (let i = 0; i < dosyalar.length; i += 1) {
      setIlerleme({ i: i + 1, n: dosyalar.length });
      try { await repo.album.upload(dosyalar[i]); }
      catch (err) {
        setHata(String(err?.message || '').includes('demo-album-full') ? t('album.demoFull') : t('album.error'));
        break;
      }
    }
    setIlerleme(null);
    await yukle();
    bump();
  };

  const sil = async (id) => {
    if (soru !== id) { setSoru(id); return; }
    setSoru(null);
    try { await repo.album.remove(id); } catch { setHata(t('album.error')); }
    await yukle();
    bump();
  };

  return (
    <Sheet onClose={onClose} title={t('album.title')}>
      <p className="faint" style={{ marginTop: 0 }}>{t('album.hint')}</p>

      {rows === null ? <Empty>{t('common.loading')}</Empty>
        : rows.length === 0 ? <Empty>{t('album.empty')}</Empty>
        : (
          <div className="album-grid">
            {rows.map((p) => (
              <div key={p.id} className="album-grid__item">
                <img src={p.url} alt="" loading="lazy" decoding="async" />
                <button type="button" className={'album-grid__del' + (soru === p.id ? ' album-grid__del--ask' : '')}
                  onClick={() => sil(p.id)} aria-label={t('common.delete')}>
                  {soru === p.id ? t('album.confirmDelete') : '✕'}
                </button>
              </div>
            ))}
          </div>
        )}

      {hata && <div className="tag tag--danger" style={{ marginTop: 'var(--sp-3)' }}>{hata}</div>}

      <input ref={giris} type="file" accept="image/*" multiple hidden onChange={sec} />
      <button type="button" className="btn btn--block" style={{ marginTop: 'var(--sp-4)' }}
        disabled={Boolean(ilerleme)} onClick={() => giris.current?.click()}>
        {ilerleme ? t('album.uploading', ilerleme.i, ilerleme.n) : '📷 ' + t('album.add')}
      </button>
    </Sheet>
  );
}
