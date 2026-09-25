// lib/data/offlineCache.js — son görülen veriyi sakla, ağ yokken onu göster.
//
// KAPSAM BİLEREK DAR: yalnızca OKUMA. Çevrimdışı YAZMA KUYRUĞU YOK.
// Gerekçe: bu uygulamada iş mantığı veritabanında (tetikleyiciler, RPC'ler,
// RLS). Sonradan tekrar oynatılan bir yazma kuyruğu, iki kişi aynı anda
// dokunduğunda çakışır ve parada sessizce çift kayıt üretir. Yarım çalışan bir
// kuyruk hiç olmamasından kötüdür: kullanıcı kaydettiğini sanır. Bu yüzden
// çevrimdışıyken yazma hâlâ engelli ve kullanıcıya açıkça söyleniyor
// (AppShell'deki uyarı şeridi); yalnızca SON HÂLİ görünür kalıyor.
//
// Önbellek kullanıcıya göre ayrılır ve çıkışta silinir — aynı cihazda başka
// biri giriş yaparsa öncekinin hane verisini görmemeli.

const PREFIX = 'yuva:cache:';
const VERSION = 1;
// Tarayıcı kotası ~5 MB; tek kayıt için üst sınır. Aşarsa yazma atlanır ve
// eski (geçerli) kayıt bozulmadan kalır.
const MAX_BYTES = 1500000;

const isBrowser = () => typeof window !== 'undefined';
const keyOf = (userId, name) => `${PREFIX}${userId || 'anon'}:${name}`;

/**
 * Önbellekten oku.
 * @returns {{data:any, ts:string}|null} kayıt yoksa, bozuksa veya sürüm
 *   eskiyse null — eski biçimi okumaya çalışmaktansa ağa gitmek yeğdir.
 */
export function readCache(userId, name) {
  if (!isBrowser()) return null;
  try {
    const raw = localStorage.getItem(keyOf(userId, name));
    if (!raw) return null;
    const box = JSON.parse(raw);
    if (box?.v !== VERSION || !box.ts) return null;
    return { data: box.data, ts: box.ts };
  } catch { return null; }
}

/** Başarılı her okumadan sonra yaz. Hata yutulur: önbellek asla yol kesmez. */
export function writeCache(userId, name, data) {
  if (!isBrowser()) return;
  try {
    const raw = JSON.stringify({ v: VERSION, ts: new Date().toISOString(), data });
    if (raw.length > MAX_BYTES) return;
    localStorage.setItem(keyOf(userId, name), raw);
  } catch { /* kota dolu veya depo kapalı — önemsiz */ }
}

/** Çıkışta hepsini sil (cihazı paylaşan başka biri öncekinin verisini görmesin). */
export function clearCache() {
  if (!isBrowser()) return;
  try {
    for (const k of Object.keys(localStorage)) {
      // Albümün imzalı adresleri de gider: çıkış yapan kişinin özel
      // fotoğraflarına giden adres cihazda kalmasın.
      if (k.startsWith(PREFIX) || k.startsWith('yuva:album-url:')) localStorage.removeItem(k);
    }
  } catch { /* önemsiz */ }
}

/**
 * Ağ hatası mı, yoksa sunucunun verdiği gerçek bir hata mı?
 * Yetki hatasında önbelleğe düşmek YANLIŞ olur: kullanıcı görmemesi gereken
 * veriyi görmeye devam eder. Yalnızca "ulaşamadım" hâllerinde önbellek.
 */
export function isNetworkError(e) {
  if (!e) return false;
  if (isBrowser() && navigator.onLine === false) return true;
  const m = String(e.message || e).toLowerCase();
  return m.includes('fetch') || m.includes('network') || m.includes('timeout')
      || m.includes('aborted') || e.name === 'TypeError';
}
