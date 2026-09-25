import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const sw = readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8');
const shell = readFileSync(new URL('../components/AppShell.jsx', import.meta.url), 'utf8');

// Bu dosyanın tamamı tek bir hatanın nöbetçisi: telefondaki uygulama
// günlerce kendini yenilemedi, üç gün önce yayınlanan ekranlar bile
// görünmüyordu. Buradaki parçalardan biri düşerse aynı hata sessizce geri
// gelir — ve fark edilmesi günler alır, çünkü yayın tarafı sağlam görünür.

test('önbellek sürümü v2 değil: eski önbelleğin silinmesi buna bağlı', () => {
  const m = /const CACHE = '([^']+)'/.exec(sw);
  assert.ok(m, 'CACHE adı bulunamadı');
  assert.notEqual(m[1], 'yuva-shell-v2');
  assert.match(m[1], /^yuva-shell-v[3-9]\d*$/);
});

test('eski önbellekler activate sırasında siliniyor', () => {
  assert.match(sw, /caches\.keys\(\)/);
  assert.match(sw, /caches\.delete/);
  assert.match(sw, /clients\.claim/);
});

test('KURULUŞTA SAYFA ÖNBELLEĞE ALINMIYOR', () => {
  // Eskiden altı sayfa kurulum anında saklanıyordu; uygulama ilk günkü
  // HTML'iyle yaşlanıyordu. Sayfalar ziyaret edildikçe zaten saklanıyor.
  const m = /const SHELL = \[([^\]]*)\]/.exec(sw);
  assert.ok(m, 'SHELL bulunamadı');
  const girdiler = m[1].split(',').map((x) => x.trim().replace(/'/g, '')).filter(Boolean);
  const sayfalar = girdiler.filter((x) => /^\/(takvim|para|planlar|aile|ayarlar)\//.test(x));
  assert.deepEqual(sayfalar, []);
});

test('sw.js ve manifest önbellekten SERVİS EDİLMİYOR', () => {
  // Güncellemeyi taşıyan dosyalar bunlar. Önbellekten verilirlerse uygulama
  // kendi yeniliğini hiç göremez.
  assert.match(sw, /url\.pathname === '\/sw\.js'/);
  assert.match(sw, /url\.pathname === '\/manifest\.json'/);
});

test('sayfalar önce AĞDAN alınıyor, önbellek yalnızca yedek', () => {
  const i = sw.indexOf('// Sayfalar');
  assert.notEqual(i, -1);
  const govde = sw.slice(i);
  // try içinde fetch, catch içinde caches.match → ağ önce.
  assert.ok(govde.indexOf('await fetch(e.request)') < govde.indexOf('} catch {'));
});

test('yalnızca 200 yanıtlar saklanıyor (502 zehirlenmesi nöbetçisi)', () => {
  assert.match(sw, /r\.ok && r\.status === 200/);
});

test('sayfa yeni sürümü DEVRALMASINI söyleyebiliyor', () => {
  assert.match(sw, /addEventListener\('message'/);
  assert.match(sw, /skipWaiting/);
  assert.match(shell, /postMessage\('skipWaiting'\)/);
});

test('KAYIT ADRESİ SÜRÜM TAŞIYOR — bu olmadan güncelleme hiç çalışmıyor', () => {
  // sw.js dosyası yayından yayına değişmiyor; tarayıcı güncellemeye yalnızca
  // ona bakıyor ve "yeni sürüm yok" diyor. Tarayıcı denemesinde sürümsüz
  // kayıtla yeni yayın açık duran uygulamaya hiç ulaşmadı.
  assert.match(shell, /register\(`\/sw\.js\?v=\$\{process\.env\.NEXT_PUBLIC_BUILD\}`\)/);
});

test('AppShell açılışta VE öne gelince güncelleme soruyor', () => {
  assert.match(shell, /\.update\(\)/);
  assert.match(shell, /visibilitychange/);
  assert.match(shell, /updatefound/);
});

test('SONSUZ YENİLEME DÖNGÜSÜ KORUMASI VAR', () => {
  // controllerchange bazı tarayıcılarda birden fazla kez tetikleniyor.
  // Kilit olmazsa telefon kendini durmadan yeniler — kullanıcı için
  // güncellenmemekten çok daha kötü.
  const i = shell.indexOf('const onControllerChange');
  assert.notEqual(i, -1, 'controllerchange işleyicisi bulunamadı');
  const govde = shell.slice(i, shell.indexOf('};', i) + 2);
  assert.match(govde, /if \(yenilendi\) return;/);
  assert.match(govde, /yenilendi = true;/);
  assert.match(govde, /location\.reload\(\)/);
  assert.match(shell, /addEventListener\('controllerchange'/);
});

test('YAYIN KOMUTU SABİTLENMİŞ — postbuild atlanmasın', () => {
  // Vercel, Next.js projesinde varsayılan olarak `next build` komutunu
  // DOĞRUDAN çalıştırıyor, `npm run build` değil. O zaman npm'in postbuild
  // adımı atlanıyor ve version.json hiç üretilmiyor; yayında 404 dönüyordu,
  // yani uygulamanın yeni sürümü fark etme yeteneği sessizce çalışmıyordu.
  const v = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'));
  assert.equal(v.buildCommand, 'npm run build');
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  assert.match(pkg.scripts.postbuild, /yayin-surumu/);
});

test('sürüm bilgisi derlemeye gömülüyor ve ekranda gösteriliyor', () => {
  const cfg = readFileSync(new URL('../next.config.mjs', import.meta.url), 'utf8');
  assert.match(cfg, /NEXT_PUBLIC_BUILD/);
  assert.match(cfg, /VERCEL_GIT_COMMIT_SHA/);
  const ayarlar = readFileSync(new URL('../app/ayarlar/page.jsx', import.meta.url), 'utf8');
  assert.match(ayarlar, /NEXT_PUBLIC_BUILD/);
});
