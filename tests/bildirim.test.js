// tests/bildirim.test.js — telefona bildirim (0026).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { pushDurumu, anahtarBaytlari } from '../lib/push.js';

const temel = { hasSW: true, hasPush: true, hasNotification: true, isIOS: false, standalone: false, permission: 'default', subscribed: false };

test('durum: iPhone tarayıcı sekmesinde önce ana ekrana eklemek gerekiyor', () => {
  // Safari yalnızca ana ekrana eklenmiş uygulamada bildirim veriyor. Bu
  // söylenmezse düğme "hiçbir şey yapmıyor" gibi görünür.
  assert.equal(pushDurumu({ ...temel, isIOS: true, standalone: false, hasPush: false }), 'ios-install');
  assert.equal(pushDurumu({ ...temel, isIOS: true, standalone: true }), 'off');
});

test('durum: izin reddedildiyse bunu söyle, tekrar izin isteme', () => {
  assert.equal(pushDurumu({ ...temel, permission: 'denied' }), 'denied');
});

test('durum: izin + abonelik = açık; izin var abonelik yok = kapalı', () => {
  assert.equal(pushDurumu({ ...temel, permission: 'granted', subscribed: true }), 'on');
  assert.equal(pushDurumu({ ...temel, permission: 'granted', subscribed: false }), 'off');
});

test('durum: desteklemeyen tarayıcı', () => {
  assert.equal(pushDurumu({ ...temel, hasPush: false }), 'unsupported');
});

test('VAPID anahtarı 65 baytlık sıkıştırılmamış P-256 noktasına çevrilir', () => {
  const key = 'BJ0mYTntUEyHTeoAR_ncVElK6Cba8Re6WJ1h4fXpwqFVWOzdGXxnWdOSIzXLYtQez5K144gkDcKZg-YQRrhuayk';
  const b = anahtarBaytlari(key);
  assert.equal(b.length, 65);
  assert.equal(b[0], 4);
});

test('service worker bildirimi gösteriyor ve dokununca ilgili sayfayı açıyor', () => {
  const sw = readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8');
  assert.match(sw, /addEventListener\('push'/);
  assert.match(sw, /showNotification\(/);
  assert.match(sw, /addEventListener\('notificationclick'/);
});

test('GİZLİ ANAHTAR DEPODA YOK — depo herkese açık', () => {
  // VAPID özel anahtarı ve cron sırrı Supabase Vault'ta. Bir gün biri
  // "kolaylık olsun" diye koda yapıştırırsa bu test düşsün.
  const kok = new URL('..', import.meta.url).pathname;
  const dosyalar = [];
  const gez = (d) => {
    for (const ad of readdirSync(d)) {
      if (['node_modules', '.next', 'out', '.git'].includes(ad)) continue;
      const p = join(d, ad);
      if (statSync(p).isDirectory()) gez(p); else if (/\.(js|jsx|mjs|sql|json|md)$/.test(ad)) dosyalar.push(p);
    }
  };
  gez(kok);
  const supheli = dosyalar.filter((p) => {
    const s = readFileSync(p, 'utf8');
    return /vault\.create_secret\(\s*'[A-Za-z0-9_-]{30,}'/.test(s) || /privateKey['"]?\s*[:=]\s*['"][A-Za-z0-9_-]{40,}/.test(s);
  });
  assert.deepEqual(supheli, []);
});

test('gönderici yalnızca cron sırrı ya da oturum açmış kullanıcıyla çalışır', () => {
  const fn = readFileSync(new URL('../supabase/functions/push-send/index.js', import.meta.url), 'utf8');
  assert.match(fn, /x-cron-secret/);
  assert.match(fn, /auth\.getUser\(jwt\)/);
  assert.match(fn, /unauthorized/);
});

test('olay formunda hatırlatma seçimi var ve kapatılabiliyor', () => {
  const q = readFileSync(new URL('../components/QuickAdd.jsx', import.meta.url), 'utf8');
  assert.match(q, /reminder_minutes:/);
  assert.match(q, /notify: hatirlat !== 'off'/);
});
