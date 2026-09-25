// scripts/yayin-surumu.mjs — derlemeden ÖNCE public/version.json yazar.
//
// NEDEN: açık duran uygulamanın yeni bir yayın olduğunu ANLAMASI gerekiyor.
// Uygulama "şu an hangi sürüm yayında?" diye buna soruyor (lib/surum.js).
//
// NEDEN public/ VE NEDEN ÖNCE: ilk denemede dosya derlemeden SONRA out/
// içine yazılıyordu. Yerelde çalıştı, yayında çalışmadı — Vercel'in Next
// derleyicisi çıktıyı kendi üretiyor ve out/ klasörüne sonradan eklenen
// dosyaları almıyor; /version.json canlıda 404 dönüyordu. public/ ise Next'in
// kendisi tarafından kopyalanıyor, o yüzden dosya derlemeden önce oraya
// yazılıyor. Canlı adres kontrol edilmeseydi bu sessizce kalırdı.
//
// npm bunu `build`den önce kendiliğinden çalıştırır (prebuild).
import { writeFileSync } from 'node:fs';

const build = (process.env.VERCEL_GIT_COMMIT_SHA || '').slice(0, 7) || 'yerel';
const icerik = { build, at: new Date().toISOString() };
writeFileSync(new URL('../public/version.json', import.meta.url), JSON.stringify(icerik) + '\n');
console.log('public/version.json ->', JSON.stringify(icerik));
