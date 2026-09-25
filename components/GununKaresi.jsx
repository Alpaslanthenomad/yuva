'use client';
import { useEffect, useState } from 'react';
import { useApp } from './AppShell.jsx';
import AlbumSheet from './AlbumSheet.jsx';
import { useT } from '../lib/i18n/context.jsx';
import { sahne } from '../lib/album.js';

/**
 * Bugün ekranının tepesi: günün karesi + selam + tarih.
 *
 * NEDEN BURADA: para kartı ve alışveriş listesi çıkınca ekranın başı boş
 * kalmıştı. Başlık satırı zaten selam ve tarihten ibaretti; ikisi fotoğrafın
 * üstüne taşındı. Yeni bir kart eklenmedi, var olan başlık güzelleşti.
 *
 * FOTOĞRAF YOKSA: saate göre değişen bir And dağları çizimi. Dışarıdan resim
 * çekilmiyor (uygulama statik ve çevrimdışı çalışıyor; başkasının sunucusuna
 * her açılışta istek atmak da gizlilik açığı olurdu).
 *
 * Fotoğrafa dokununca kırpılmamış hali açılır. Sağ üstteki küçük düğme
 * albümü açar — yönetim, gördüğün yerin hemen yanında.
 */
export default function GununKaresi({ title, sub }) {
  const { repo, household, tick } = useApp();
  const t = useT();
  const [foto, setFoto] = useState(null);
  // Hangi adres yüklendi: fotoğraf değişince yenisi de yumuşakça belirsin.
  const [yuklenen, setYuklenen] = useState(null);
  const [bozuk, setBozuk] = useState(false);
  const [buyuk, setBuyuk] = useState(false);
  const [album, setAlbum] = useState(false);
  const [hal, setHal] = useState(() => sahne(new Date().getHours()));

  useEffect(() => {
    if (!household || !repo.album) return undefined;
    let iptal = false;
    repo.album.photoOfDay().then((r) => {
      if (iptal) return;
      setFoto(r); setBozuk(false);
    }).catch(() => { if (!iptal) setFoto({ count: 0 }); });
    return () => { iptal = true; };
  }, [repo, household, tick]);

  // Sahne saat ilerledikçe değişsin (uygulama açık kalırsa).
  useEffect(() => {
    const id = setInterval(() => setHal(sahne(new Date().getHours())), 10 * 60 * 1000);
    return () => clearInterval(id);
  }, []);

  const resimVar = Boolean(foto?.url) && !bozuk;
  const adet = foto?.count || 0;

  return (
    <>
      <section className={'hero' + (resimVar ? ' hero--photo' : '')}>
        {resimVar ? (
          <button type="button" className="hero__tap" onClick={() => setBuyuk(true)} aria-label={t('album.open')}>
            <img key={foto.url} className={'hero__img' + (yuklenen === foto.url ? ' hero__img--ready' : '')}
              src={foto.url} alt="" decoding="async"
              onLoad={() => setYuklenen(foto.url)} onError={() => setBozuk(true)} />
          </button>
        ) : <AndSahnesi hal={hal} />}
        <div className="hero__scrim" aria-hidden="true" />
        <div className="hero__text">
          <h1 className="hero__title">{title}</h1>
          {sub && <div className="hero__sub">{sub}</div>}
        </div>
        <button type="button" className="hero__chip" onClick={() => setAlbum(true)}>
          📷 {adet > 0 ? t('album.count', adet) : t('album.chipEmpty')}
        </button>
      </section>

      {buyuk && resimVar && (
        <div className="lightbox" role="dialog" aria-modal="true" onClick={() => setBuyuk(false)}>
          <img src={foto.url} alt="" />
        </div>
      )}
      {album && <AlbumSheet onClose={() => setAlbum(false)} />}
    </>
  );
}

/**
 * And dağları — Santiago'dan görünen sıradağın sade bir çizimi.
 * Renkler tokens.css'teki --scene-* değişkenlerinden; `hal` sınıfı hangisinin
 * kullanılacağını seçiyor (şafak / gün / akşam / gece).
 */
export function AndSahnesi({ hal }) {
  return (
    <svg className={'hero__scene sahne--' + hal} viewBox="0 0 400 250" preserveAspectRatio="xMidYMid slice"
      aria-hidden="true" data-hal={hal}>
      <defs>
        <linearGradient id="gok" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" style={{ stopColor: 'var(--sky-1)' }} />
          <stop offset="1" style={{ stopColor: 'var(--sky-2)' }} />
        </linearGradient>
      </defs>
      <rect width="400" height="250" fill="url(#gok)" />
      {hal === 'night' && (
        <g className="sahne__yildiz">
          {[[40, 30], [90, 60], [150, 22], [210, 48], [260, 18], [330, 40], [370, 70], [120, 95], [300, 90], [20, 80]]
            .map(([x, y]) => <circle key={x + '-' + y} cx={x} cy={y} r="1.2" />)}
        </g>
      )}
      {/* Güneş/ay sağ üstteki albüm düğmesinin altında kalmasın. */}
      <circle className="sahne__gunes" cx={{ dusk: 90, dawn: 320, day: 120, night: 80 }[hal] || 120}
        cy={hal === 'day' ? 55 : hal === 'night' ? 50 : 118} r={hal === 'night' ? 14 : 22} />
      {/* Arka sıra: uzak, soluk */}
      <path className="sahne__uzak"
        d="M0 150 L40 118 L70 132 L110 92 L150 124 L185 100 L220 128 L260 84 L300 120 L340 98 L400 132 L400 250 L0 250 Z" />
      {/* Ön sıra: yakın, koyu, karlı zirveler */}
      <path className="sahne__yakin"
        d="M0 190 L50 150 L85 168 L130 118 L170 160 L205 140 L240 172 L285 110 L330 158 L365 140 L400 162 L400 250 L0 250 Z" />
      <path className="sahne__kar" d="M130 118 L118 131 L126 129 L132 134 L139 127 L144 131 Z" />
      <path className="sahne__kar" d="M285 110 L272 125 L280 123 L287 129 L294 121 L300 126 Z" />
      {/* Şehir ışıkları / ön plan: ince bir tepe çizgisi */}
      <path className="sahne__on" d="M0 222 Q100 205 200 218 T400 212 L400 250 L0 250 Z" />
    </svg>
  );
}
