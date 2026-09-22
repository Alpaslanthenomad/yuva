import { test } from 'node:test';
import assert from 'node:assert/strict';

// offlineCache tarayıcıda çalışıyor; node'da window/localStorage yok.
// Modül import edilmeden önce sahtesi kurulur.
const store = new Map();
globalThis.window = globalThis;
// node 22'de navigator salt okunur bir getter; yeniden tanımlamak gerekiyor.
Object.defineProperty(globalThis, 'navigator', { value: { onLine: true }, configurable: true, writable: true });
const fake = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
};
// clearCache Object.keys(localStorage) ile geziyor; proxy anahtarları verir.
globalThis.localStorage = new Proxy(fake, {
  ownKeys: () => [...store.keys()],
  getOwnPropertyDescriptor: () => ({ enumerable: true, configurable: true }),
});

const { readCache, writeCache, clearCache, isNetworkError } = await import('../lib/data/offlineCache.js');

test('önbellek yaz-oku: veri ve zaman damgası geri gelir', () => {
  writeCache('u1', 'bootstrap', { household: { id: 'h1' }, members: [1, 2] });
  const got = readCache('u1', 'bootstrap');
  assert.equal(got.data.household.id, 'h1');
  assert.equal(got.data.members.length, 2);
  assert.ok(/^\d{4}-\d{2}-\d{2}T/.test(got.ts));
});

test('önbellek: kullanıcılar birbirininkini görmez', () => {
  writeCache('u1', 'bootstrap', { household: { id: 'h1' } });
  writeCache('u2', 'bootstrap', { household: { id: 'h2' } });
  assert.equal(readCache('u1', 'bootstrap').data.household.id, 'h1');
  assert.equal(readCache('u2', 'bootstrap').data.household.id, 'h2');
  assert.equal(readCache('u3', 'bootstrap'), null);
});

test('önbellek: bozuk veya eski sürüm kayıt null döner, patlamaz', () => {
  store.set('yuva:cache:u9:bootstrap', '{bu json degil');
  assert.equal(readCache('u9', 'bootstrap'), null);
  store.set('yuva:cache:u9:bootstrap', JSON.stringify({ v: 99, ts: 'x', data: {} }));
  assert.equal(readCache('u9', 'bootstrap'), null);
});

test('çıkışta tüm önbellek silinir, yabancı anahtara dokunulmaz', () => {
  writeCache('u1', 'bootstrap', { a: 1 });
  writeCache('u2', 'today|2026-09-22|7|2026-09', { b: 2 });
  store.set('baska:anahtar', 'dokunma');
  clearCache();
  assert.equal(readCache('u1', 'bootstrap'), null);
  assert.equal(readCache('u2', 'today|2026-09-22|7|2026-09'), null);
  assert.equal(store.get('baska:anahtar'), 'dokunma');
});

test('isNetworkError: yetki hatasında önbelleğe DÜŞÜLMEZ', () => {
  // Kritik ayrım: yetki hatasında önbellek kullanılırsa kullanıcı artık
  // görmemesi gereken veriyi görmeye devam eder.
  navigator.onLine = true;
  assert.equal(isNetworkError(new Error('Failed to fetch')), true);
  assert.equal(isNetworkError({ message: 'network timeout' }), true);
  assert.equal(isNetworkError(new Error('yetki yok')), false);
  assert.equal(isNetworkError({ message: 'JWT expired', name: 'AuthError' }), false);
  assert.equal(isNetworkError({ message: 'new row violates row-level security policy' }), false);
  assert.equal(isNetworkError(null), false);
});

test('isNetworkError: tarayıcı çevrimdışıysa her hata ağ hatasıdır', () => {
  navigator.onLine = false;
  assert.equal(isNetworkError(new Error('herhangi bir hata')), true);
  navigator.onLine = true;
});
