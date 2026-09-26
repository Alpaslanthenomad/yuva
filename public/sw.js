// YUVA service worker — uygulama kabuğu önbelleği.
//
// 2026-09-21: eski sürüm gelen YANITI durumuna bakmadan önbelleğe yazıyordu.
// Vercel bir an 502 döndürdüğünde o hata sayfası kalıcı olarak önbelleğe
// giriyordu. Artık yalnızca başarılı (200) yanıtlar saklanıyor.
//
// 2026-09-25 — ASIL SORUN BUYDU: telefondaki uygulama günlerce kendini
// yenilemiyordu. Üç gün önce yayınlanan ekranlar bile görünmüyordu.
// Service worker bir kez kurulduktan sonra kimse ona "yeni sürüm var mı?"
// diye sormuyordu; ana ekrana eklenmiş uygulama açıldığında sayfa baştan
// yüklenmediği için eski kopya çalışmaya devam ediyordu.
//
// Çözümün yarısı burada (sürüm adı değişti → eski önbellek tamamen silinir),
// yarısı AppShell'de (açılışta ve öne her gelişte güncelleme sorulur, yeni
// sürüm devralınca sayfa bir kez yenilenir).
//
// KURULUŞTA ARTIK SAYFA ÖNBELLEĞE ALINMIYOR. Eskiden altı sayfa kurulum
// anında saklanıyordu; bu, uygulamanın ilk günkü HTML'iyle yaşlanmasına
// zemin hazırlıyordu. Sayfalar zaten ziyaret edildikçe saklanıyor.
const CACHE = 'yuva-shell-v3';
const SHELL = ['/', '/manifest.json'];

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

// Sayfa "hemen devral" diyebilsin diye.
self.addEventListener('message', (e) => {
  if (e.data === 'skipWaiting') self.skipWaiting();
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return; // Supabase vb. → ağ

  // Parmak izli statik dosyalar: önce önbellek, yoksa ağ. Güvenli, çünkü
  // dosya adı içeriğin özetini taşır — içerik değişirse ad da değişir.
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

  // sw.js ve manifest: her zaman ağdan. Güncellemeyi taşıyan dosyalar
  // bunlar; önbellekten verilirse uygulama kendi yeniliğini göremez.
  if (url.pathname === '/sw.js' || url.pathname === '/manifest.json') return;

  // Sayfalar: önce ağ, düşerse önbellek.
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

// ---------------------------------------------------------------------------
// BİLDİRİMLER (0026). Sunucu şifreli bir paket gönderir; tarayıcı çözüp bu
// olayı tetikler. Paket: { title, body, url, tag }. Aynı "tag" ile gelen yeni
// bildirim eskisinin yerine geçer (ör. aynı olayın ikinci hatırlatması).
self.addEventListener('push', (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch { d = { body: e.data ? e.data.text() : '' }; }
  e.waitUntil(self.registration.showNotification(d.title || 'YUVA', {
    body: d.body || '',
    tag: d.tag || undefined,
    renotify: Boolean(d.tag),
    data: { url: d.url || '/' },
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    lang: 'tr',
  }));
});

// Bildirime dokununca: uygulama açıksa öne getir ve ilgili sayfaya git,
// kapalıysa o sayfayla aç.
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const hedef = new URL((e.notification.data && e.notification.data.url) || '/', self.location.origin).href;
  e.waitUntil((async () => {
    const pencereler = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of pencereler) {
      if ('focus' in c) {
        await c.focus();
        if ('navigate' in c) { try { await c.navigate(hedef); } catch { /* başka kökene geçilemez */ } }
        return;
      }
    }
    await self.clients.openWindow(hedef);
  })());
});
