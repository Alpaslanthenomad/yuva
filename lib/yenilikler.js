// lib/yenilikler.js — Bugün ekranındaki tek seferlik "Yenilikler" kartı.
//
// Uygulamayı zaten kullanan biri (Carolina) son eklenenleri kendiliğinden
// fark etmeyebilir. Rehber değil: bir kez görünür, "Anladım" deyince bu
// sürüm için bir daha çıkmaz. Yeni bir yenilik listesi yayınlanınca SURUM
// değişir ve kart yeniden görünür.
export const YENILIK_SURUMU = '2026-09';
export const YENILIK_ANAHTARI = 'yuva:yenilikler:gordu';

export const YENILIKLER = [
  { key: 'gunum',    emoji: '🗓️', href: '/gunum/' },
  { key: 'takviye',  emoji: '💊', href: '/gunum/?takviye=1' },
  { key: 'kisisel',  emoji: '👤', href: '/para/' },
  { key: 'fis',      emoji: '🧾', href: '/para/' },
  { key: 'alisveris', emoji: '🛒', href: '/aile/?sekme=shopping' },
  { key: 'plan',     emoji: '💸', href: '/planlar/' },
  { key: 'ozet',     emoji: '📊', href: '/ayarlar/' },
];

/** Bu cihazda bu sürüm görüldü mü? Depo kapalıysa gösterme (her açılışta çıkmasın). */
export function gorulduMu(depo) {
  try { return depo.getItem(YENILIK_ANAHTARI) === YENILIK_SURUMU; } catch { return true; }
}
export function gorulduYap(depo) {
  try { depo.setItem(YENILIK_ANAHTARI, YENILIK_SURUMU); } catch { /* önemsiz */ }
}
