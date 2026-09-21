// YUVA service worker — app-shell cache-first, API network-only.
//
// 2026-09-21 düzeltmesi: eski sürüm gelen YANITI durumuna bakmadan
// önbelleğe yazıyordu. Vercel bir an 502 döndürdüğünde o hata sayfası
// kalıcı olarak önbelleğe giriyor, /_next/static/ cache-first olduğu için
// telefon bir daha kendiliğinden düzelmiyordu (script MIME hatası). Artık
// yalnızca başarılı (200) yanıtlar saklanıyor ve sürüm adı değişince eski
// önbellek tamamen siliniyor.
const CACHE = 'yuva-shell-v2';
const SHELL = ['/', '/takvim/', '/para/', '/planlar/', '/aile/', '/ayarlar/', '/manifest.json'];

/** Yalnızca gerçekten işe yarayan yanıtlar saklanır. */
const saklanabilir = (r) => r && r.ok && r.status === 200 && r.type === 'basic';

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL).catch(() => {})));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return; // Supabase vb. → ağ

  // Parmak izli statik dosyalar: önce önbellek, yoksa ağ (ve yalnızca sağlamsa sakla)
  if (url.pathname.startsWith('/_next/static/')) {
    e.respondWith((async () => {
      const c = await caches.open(CACHE);
      const hit = await c.match(e.request);
      if (hit) return hit;
      const r = await fetch(e.request);
      if (saklanabilir(r)) c.put(e.request, r.clone());
      return r;
    })());
    return;
  }

  // Sayfalar: önce ağ, düşerse önbellek
  e.respondWith((async () => {
    try {
      const r = await fetch(e.request);
      if (saklanabilir(r)) {
        const c = await caches.open(CACHE);
        c.put(e.request, r.clone());
      }
      return r;
    } catch {
      const c = await caches.open(CACHE);
      return (await c.match(e.request)) || (await c.match('/')) || Response.error();
    }
  })());
});
