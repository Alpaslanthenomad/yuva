// scripts/yayin-surumu.mjs — derlemeden sonra out/version.json yazar.
//
// NEDEN: açık duran uygulamanın yeni bir yayın olduğunu ANLAMASI gerekiyor.
// Service worker'a güvenmek yetmiyor; tarayıcı güncellemeye bakarken yalnızca
// sw.js dosyasını karşılaştırıyor ve o dosya yayından yayına değişmiyor.
// Üstelik çalışan sayfa eski kodu taşıdığı için kendi kayıt adresini de
// değiştiremiyor. Bu yüzden sunucuda, önbelleğe alınmayan küçük bir dosya
// duruyor: uygulama "şu an hangi sürüm yayında?" diye buna soruyor.
//
// npm bunu `build`den sonra kendiliğinden çalıştırır (postbuild).
import { writeFileSync } from 'node:fs';

const build = (process.env.VERCEL_GIT_COMMIT_SHA || '').slice(0, 7) || 'yerel';
const icerik = { build, at: new Date().toISOString() };
writeFileSync(new URL('../out/version.json', import.meta.url), JSON.stringify(icerik) + '\n');
console.log('version.json ->', JSON.stringify(icerik));
