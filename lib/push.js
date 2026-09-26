// lib/push.js — telefona bildirim (Web Push) için tarayıcı tarafı.
//
// Asıl iş sunucuda (0026): ne zaman hangi hatırlatmanın gideceği orada
// hesaplanıyor. Burada yalnızca üç şey var: bu cihaz bildirim alabilir mi,
// izin iste + abone ol, aboneliği sunucuya bildir.
//
// iPHONE: Safari bildirimi YALNIZCA ana ekrana eklenmiş uygulamada destekliyor
// (iOS 16.4+). Tarayıcı sekmesindeyken "önce ana ekrana ekle" demek gerekiyor;
// yoksa düğme hiçbir şey yapmıyor gibi görünür.

/**
 * Cihazın durumu. Saf fonksiyon — tarayıcıdan okunan bilgiler parametre.
 * @returns {'unsupported'|'ios-install'|'denied'|'off'|'on'}
 */
export function pushDurumu({ hasSW, hasPush, hasNotification, isIOS, standalone, permission, subscribed }) {
  if (isIOS && !standalone) return 'ios-install';
  if (!hasSW || !hasPush || !hasNotification) return 'unsupported';
  if (permission === 'denied') return 'denied';
  if (permission === 'granted' && subscribed) return 'on';
  return 'off';
}

/** VAPID anahtarı (base64url) → abonelik için Uint8Array. */
export function anahtarBaytlari(b64url) {
  const pad = '='.repeat((4 - (b64url.length % 4)) % 4);
  const b64 = (b64url + pad).replace(/-/g, '+').replace(/_/g, '/');
  const raw = typeof atob === 'function' ? atob(b64) : Buffer.from(b64, 'base64').toString('binary');
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

/** Tarayıcıdan okunan bilgiler. */
export async function cihazBilgisi() {
  if (typeof window === 'undefined') return { hasSW: false };
  const ua = navigator.userAgent || '';
  const isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const standalone = window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone === true;
  const hasSW = 'serviceWorker' in navigator;
  const hasPush = 'PushManager' in window;
  const hasNotification = 'Notification' in window;
  let subscribed = false;
  if (hasSW && hasPush) {
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      subscribed = Boolean(await reg?.pushManager.getSubscription());
    } catch { /* önemsiz */ }
  }
  return {
    hasSW, hasPush, hasNotification, isIOS, standalone, subscribed,
    permission: hasNotification ? Notification.permission : 'default',
  };
}

/**
 * İzin iste, abone ol, sunucuya yaz. İzin penceresi YALNIZCA kullanıcı bir
 * düğmeye bastığında açılabilir (tarayıcı kuralı) — bu yüzden bu fonksiyon
 * yalnızca düğmeden çağrılıyor.
 */
export async function bildirimleriAc(repo) {
  const izin = await Notification.requestPermission();
  if (izin !== 'granted') return izin;
  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    const key = await repo.push.vapidKey();
    sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: anahtarBaytlari(key) });
  }
  await repo.push.subscribe(sub.toJSON(), navigator.userAgent);
  return 'granted';
}

export async function bildirimleriKapat(repo) {
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  if (sub) {
    try { await repo.push.unsubscribe(sub.endpoint); } catch { /* sunucu yoksa da yerelde kapansın */ }
    await sub.unsubscribe();
  }
}

/**
 * Açılışta sessiz eşitleme: izin verilmiş ve abonelik varsa sunucuya tekrar
 * yaz (tarayıcı aboneliği yenilemiş olabilir). İzin yoksa hiçbir şey sormaz.
 */
export async function aboneligiTazele(repo) {
  try {
    if (typeof window === 'undefined' || !('Notification' in window) || Notification.permission !== 'granted') return;
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = await reg?.pushManager.getSubscription();
    if (sub) await repo.push.subscribe(sub.toJSON(), navigator.userAgent);
  } catch { /* sessiz */ }
}
