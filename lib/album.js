// lib/album.js — aile albümü için saf yardımcılar (tarayıcısız test edilir).
//
// Günün karesinin SEÇİMİ veritabanında (0023 photo_of_day). Buradaki
// gununSirasi() onun aynası; yalnızca demo kipinde kullanılıyor ve
// tests/album.test.js iki tarafın aynı formülü kullandığını sabitliyor.
import { daysBetween } from './dates.js';

/** SQL'deki başlangıç günü. Değişirse iki taraf birlikte değişmeli. */
export const ALBUM_EPOCH = '2024-01-01';

/**
 * O gün kaçıncı fotoğraf gösterilecek (0 tabanlı). Fotoğraf yoksa -1.
 * Aynı gün herkes aynı sırayı alır; ardışık günler sırayla döner.
 */
export function gununSirasi(dateISO, adet) {
  if (!adet || adet < 1) return -1;
  const g = daysBetween(ALBUM_EPOCH, dateISO);
  return ((g % adet) + adet) % adet;
}

/**
 * Küçültme boyutu: en uzun kenar `max`'ı geçmesin, oran korunsun,
 * küçük fotoğraf BÜYÜTÜLMESİN (bulanıklaşır, boşuna yer kaplar).
 */
export function olcekle(w, h, max = 1600) {
  const W = Math.max(1, Math.round(Number(w) || 0));
  const H = Math.max(1, Math.round(Number(h) || 0));
  const k = Math.min(1, max / Math.max(W, H));
  return { w: Math.max(1, Math.round(W * k)), h: Math.max(1, Math.round(H * k)) };
}

/**
 * Günün saatine göre sahne: fotoğraf yokken gösterilen And dağları çizimi
 * bu dört halden birine bürünür. Saat sınırları Santiago'nun ortalama gün
 * doğumu/batımına göre kabaca seçildi; kesinlik değil ruh hali.
 */
export function sahne(saat) {
  const s = Number(saat);
  if (s >= 5 && s < 8) return 'dawn';
  if (s >= 8 && s < 18) return 'day';
  if (s >= 18 && s < 21) return 'dusk';
  return 'night';
}

/** Selamlama anahtarı (i18n): saat kaçsa ona uygun. */
export function selamAnahtari(saat) {
  const s = Number(saat);
  if (s >= 5 && s < 12) return 'today.hello.morning';
  if (s >= 12 && s < 18) return 'today.hello.afternoon';
  if (s >= 18 && s < 23) return 'today.hello.evening';
  return 'today.hello.night';
}

/**
 * Tarayıcıda: seçilen dosyayı küçült ve JPEG'e çevir.
 * Yeniden kodlamanın yan etkisi bilinçli: EXIF (konum/GPS dahil) taşınmaz.
 * Telefonun döndürme bilgisi uygulanır ki fotoğraf yan yatmasın.
 * @returns {Promise<{blob: Blob, width: number, height: number}>}
 */
export async function kucult(file, max = 1600, kalite = 0.82) {
  let kaynak; let W; let H;
  try {
    kaynak = await createImageBitmap(file, { imageOrientation: 'from-image' });
    W = kaynak.width; H = kaynak.height;
  } catch {
    // Eski Safari: createImageBitmap seçenekleri desteklemiyor.
    kaynak = await new Promise((res, rej) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => { URL.revokeObjectURL(url); res(img); };
      img.onerror = (e) => { URL.revokeObjectURL(url); rej(e); };
      img.src = url;
    });
    W = kaynak.naturalWidth; H = kaynak.naturalHeight;
  }
  const { w, h } = olcekle(W, H, max);
  const tuval = document.createElement('canvas');
  tuval.width = w; tuval.height = h;
  tuval.getContext('2d').drawImage(kaynak, 0, 0, w, h);
  if (kaynak.close) kaynak.close();
  const blob = await new Promise((res) => tuval.toBlob(res, 'image/jpeg', kalite));
  if (!blob) throw new Error('image-encode');
  return { blob, width: w, height: h };
}
