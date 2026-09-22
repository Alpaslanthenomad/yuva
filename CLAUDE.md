# CLAUDE.md — YUVA çalışma kuralları

Bu repo'da çalışan her AI ajanı ve insan geliştirici şu sırayla okur:
`PROJECT_BLUEPRINT.md` → `ARCHITECTURE.md` → bu dosya → `TASK_BOARD.md`.

## Değişmez kurallar

1. **JSX only.** `app/`, `components/`, `lib/` altında `.ts`/`.tsx` dosyası
   açılmaz. Tip ipucu gerekirse JSDoc.
2. **Saf CSS.** Tailwind, styled-components, CSS modules yok. Renk/boşluk için
   yalnızca `styles/tokens.css` değişkenleri (`var(--color-*)`). Sabit hex kodu
   bileşen içinde yazılmaz.
3. **İş mantığı DB'de.** Bütçe hesabı, kur çevirimi, bakiye, yetki — hepsi
   Postgres (trigger/RPC/view). Frontend yalnızca gösterir ve gönderir.
   Frontend'de yapılan tek "mantık": tarih açılımı (RRULE) ve biçimlendirme.
4. **Repository katmanı.** Ekranlar `lib/data` dışından veri çekmez. Yeni
   veri ihtiyacı → `contract.js` + `supabaseRepo.js` + `demoRepo.js` üçü
   birlikte güncellenir.
5. **Migration disiplini.** Şema değişikliği yalnızca
   `supabase/migrations/NNNN_*.sql` ile. Studio'da elle yapılan değişiklik
   sayılmaz. Her migration idempotent olmaya çalışır (`if not exists`).
6. **Telefon önce.** Her ekran önce 390×844 (iPhone) düşünülür; masaüstü
   `@media (min-width: 900px)` ile genişletilir. Alt sekme çubuğu ve `+`
   butonu her sayfada sabit. Dokunma hedefi ≥ 44px.
7. **İki dilli (TR + ES), metinler `lib/i18n/`'de.** JSX içinde hiçbir dilde
   sabit metin yazılmaz. Her bileşen `const t = useT()` ile başlar ve
   `t('money.expense')` çağırır. `tr.js` ve `es.js` anahtar yapısı **birebir
   aynı** olmalı — `tests/i18n.test.js` bunu ve JSX'te kalan sabit Türkçe
   metni CI'da yakalar. İspanyolca **Şili varyantıdır** (arriendo, bencina,
   supermercado, mesada, Isapre). Yeni bir metin eklerken iki sözlüğe birden
   yazılır; unutulursa test kırmızı olur.
   Tarihler `lib/dates.js` içinde dile duyarlıdır (`setDateLocale`), tatil
   adları `lib/holidays.js`'te anahtar olarak tutulup sözlükten çözülür.
   Dil **kişi başınadır**: cihazda `localStorage` (`yuva:locale`), varsayılanı
   `households.locale`. Hane Şili'de yaşıyor; bir üye Türkçe, bir başkası
   İspanyolca kullanabilir — veri ortak, yalnızca arayüz dili kişiseldir.
8. **Para asla float.** Görüntüde `formatMoney`; hesapta tam sayı kuruş/peso
   (`lib/money.js`). CLP'nin ondalığı yoktur, TRY/USD 2 ondalık.
9. **Demo mod bozulmaz.** `.env` olmadan `npm run dev` çalışır ve demo veriyle
   tüm ekranlar dolu görünür. Yeni özellik demo veriye de eklenir.
10. **TASK_BOARD güncel tutulur.** Bir işe başlarken `[ ]` → `[~]`, bitince
    `[x]` + tarih. Yeni fikir "Backlog"a; bu dosyaya değil.

## Oturum başlangıç ritüeli (AI için)

```
1. TASK_BOARD.md'de [~] var mı? Varsa oradan devam.
2. Yoksa "Şimdi" bölümünden ilk [ ] görevi al, [~] yap.
3. İlgili contract/migration/ekranı oku; sonra yaz.
4. `npm test && npm run build` geçmeden bitirme.
5. TASK_BOARD güncelle; PROJECT_BLUEPRINT'te karar değiştiyse Karar Günlüğü'ne ekle.
```

## Komutlar

```bash
npm install
npm run dev        # http://localhost:3000 (demo mod, env yoksa)
npm test           # node --test tests/
npm run build      # statik export → out/
npm run serve      # out/ klasörünü yerelde sun (PWA testi için)
```

## Adlandırma

- Tablolar İngilizce, çoğul, snake_case: `calendar_events`, `shopping_items`.
- Arayüz metinleri Türkçe; route'lar Türkçe: `/takvim`, `/para`, `/planlar`,
  `/aile`, `/ayarlar`.
- Bileşenler PascalCase: `components/MoneyRow.jsx`.
- CSS sınıfları `blok__eleman--durum`.

## Giriş (auth)

E-posta + şifre. **Sihirli bağlantı (magic link) kullanılmaz** — 2026-09-21'de
kaldırıldı. Gerekçe: iki kişilik bir hanede her girişte e-posta beklemek,
bağlantıya tıklamak ve Supabase'de Site URL ayarlamak gereksiz sürtünmeydi;
üstelik ücretsiz planın e-posta kotası (saatte 2) denemelerde tükeniyordu.
Şifre Windows, Mac ve telefonda aynı çalışır, tarayıcı kaydeder.

Supabase'de **Authentication › Sign In / Providers › Email › "Confirm email"
KAPALI olmalı.** Açık kalırsa `signUp` oturum döndürmez ve uygulama
`auth.errNeedsConfirm` hatasını gösterir. Şifre değiştirme: Ayarlar › 🔑 Şifre.

## Yapılmayacaklar

- Backend'i "geçici olarak" frontend'de yazmak.
- Çocuk profillerine e-posta/şifre alanı eklemek.
- Girişe e-posta bağlantısı / OTP geri getirmek (yukarıdaki gerekçeye bak).
- Tıbbi içerik (tanı, ilaç) saklamak — yalnızca randevu tarihi.
- Demo veriyi gerçek Supabase'e seed etmek.
