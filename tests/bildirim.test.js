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

test('haftalık özet (0030): zamanlayıcıya bağlı, iç fonksiyon API’ye kapalı, tercihler iki dilde', () => {
  const sql = readFileSync(new URL('../supabase/migrations/0030_haftalik_ozet.sql', import.meta.url), 'utf8');
  assert.match(sql, /perform public\.push_schedule_weekly\(now\(\)\)/);
  assert.match(sql, /revoke all on function public\.weekly_digest\(uuid, date\) from public, anon, authenticated/);
  assert.match(sql, /grant execute on function public\.weekly_digest_preview\(uuid\) to authenticated/);
  // Eşin kişisel harcaması özete girmez: yalnızca kendi for_member_id'm.
  assert.match(sql, /for_member_id = p_member/);
  assert.doesNotMatch(sql, /for_member_id is not null/);
  const ui = readFileSync(new URL('../components/BildirimAyarlari.jsx', import.meta.url), 'utf8');
  assert.match(ui, /k="weekly"/);
});

test('hediye hatırlatması (0032): zamanlayıcıya bağlı, kendi gününe gitmez, tercihle kapanır', () => {
  const sql = readFileSync(new URL('../supabase/migrations/0032_dogum_gunu_hediye.sql', import.meta.url), 'utf8');
  assert.match(sql, /perform public\.push_schedule_occasions\(now\(\)\)/);
  assert.match(sql, /continue when o\.member_id is not distinct from m\.id/);
  assert.match(sql, /coalesce\(p\.occasions, true\)/);
  assert.match(sql, /occasions\s+= coalesce\(\(p->>'occasions'\)::boolean, occasions\)/);
});

test('otomatik katkı ve ay sonu özeti (0034): zamanlayıcıya bağlı, API’ye kapalı, eşin kişiseli yok', () => {
  const sql = readFileSync(new URL('../supabase/migrations/0034_birikim_ve_ay_sonu.sql', import.meta.url), 'utf8');
  assert.match(sql, /perform public\.goal_auto_tick\(now\(\)\)/);
  assert.match(sql, /perform public\.push_schedule_monthly\(now\(\)\)/);
  assert.match(sql, /revoke all on function public\.monthly_digest\(uuid, character\) from public, anon, authenticated/);
  assert.match(sql, /revoke all on function public\.goal_auto_tick\(timestamptz\) from public, anon, authenticated/);
  assert.match(sql, /for_member_id = p_member/);
  assert.doesNotMatch(sql, /for_member_id is not null/);
  // Hedefe ulaşınca durur; aynı ay iki kez yazmaz.
  assert.match(sql, /toplam >= g\.target_amount/);
  assert.match(sql, /g\.auto_last >= hedef_gun/);
});

test('anlık limit uyarısı (0036): yalnızca eşik bu harcamayla geçilince, ayda bir kez', () => {
  const sql = readFileSync(new URL('../supabase/migrations/0036_limit_uyarisi.sql', import.meta.url), 'utf8');
  assert.match(sql, /after insert on public\.transactions/);
  assert.match(sql, /once < 0\.8 \* lim\.amount_base and harcanan >= 0\.8 \* lim\.amount_base/);
  assert.match(sql, /'bw:' \|\| coalesce\(lim\.category_id::text, 'toplam'\) \|\| ':' \|\| per \|\| ':' \|\| esik/);
  // Kişisel limit uyarısı yalnızca sahibine.
  assert.match(sql, /perform public\.push_enqueue\(new\.for_member_id,/);
});
