# 🏡 YUVA — Aile Yönetim Sistemi

Ortak takvim · ev muhasebesi · planlama. Telefondan, tek elle, 10 saniyede.

**Shared family calendar, household ledger and planning tool — phone-first PWA.**

**🇹🇷 Türkçe · 🇨🇱 Español** — arayüz iki dilli; dil kişi başına seçilir (Ayarlar › Uygulama dili),
veri ortaktır. *La interfaz es bilingüe; cada integrante elige su idioma en Ajustes › Idioma.*

| | |
|---|---|
| Diller | Türkçe + Español (variante chilena) — kişi başına, `lib/i18n/` |
| Stack | Next.js (static export) + React/JSX · saf CSS + design tokens · Supabase (Postgres RLS/trigger/RPC) |
| Mobil | PWA — "Ana ekrana ekle"; standalone; app-shell offline |
| Para | Çoklu para birimi (CLP · TRY · USD · EUR), kur işlem tarihinde dondurulur |
| Takvim | Üye renkleri, RRULE tekrar, çakışma uyarısı, 🇨🇱 + 🇹🇷 resmi tatiller |
| Planlar | Seyahat / Davet / Proje / Birikim hedefi — bütçe vs gerçekleşen, kontrol listesi, davetli LCV |
| Aile | Üyeler (çocuklar profildir), önemli günler, belge süreleri, görevler + puan, alışveriş listesi |

## Hızlı başlangıç

```bash
npm install
npm run dev          # http://localhost:3000 — .env yoksa DEMO modu (localStorage)
npm test             # birim testler
npm run build        # statik export → out/
```

Telefonda denemek için: `npm run build && npm run serve`, ardından aynı Wi-Fi'daki
telefondan `http://<bilgisayar-ip>:3000` → "Ana ekrana ekle".

## Supabase'e bağlama (Faz 1)

1. Supabase'de proje aç → SQL Editor'da sırayla: `supabase/migrations/0001_init.sql`, `supabase/migrations/0002_i18n.sql`, sonra `supabase/seed.sql`.
2. `.env.example` → `.env` ; URL ve anon key'i yaz.
3. `npm run build` → Vercel/Netlify/Cloudflare Pages'e `out/` klasörünü at.
4. Uygulamada e-posta ile giriş → "Yeni hane kur" → eşine katılım kodunu ver.
5. (İsteğe bağlı) pg_cron aç; `seed.sql` sonundaki `cron.schedule` satırını çalıştır (vadeli faturalar).

## Proje anayasası

Okuma sırası: [`PROJECT_BLUEPRINT.md`](PROJECT_BLUEPRINT.md) → [`ARCHITECTURE.md`](ARCHITECTURE.md) → [`CLAUDE.md`](CLAUDE.md) → [`TASK_BOARD.md`](TASK_BOARD.md).

Modül listesi kasıtlı olarak **geniş** tutuldu (`PROJECT_BLUEPRINT.md §3`); ilk gerçek kullanım
haftasından sonra eleme yapılır ve TASK_BOARD güncellenir.

## Dil ekleme

`lib/i18n/xx.js` dosyasını `tr.js`'i kopyalayıp çevir → `lib/i18n/index.js` içindeki
`LOCALES`'a ekle → `lib/dates.js` içindeki `L` tablosuna ay/gün adlarını ekle →
`supabase/migrations/` ile yeni bir migration'da check kısıtlarını ve
`seed_default_categories` dallarını genişlet. `npm test` eksik anahtarları söyler.

## Ekranlar

`/` Bugün · `/takvim` · `/para` · `/planlar` · `/aile` · `/ayarlar` · `/giris` — hepsi statik, hepsi JSX.
Sağ alttaki **+** her yerden: Harcama · Olay · Görev · Alışveriş.

## Lisans

Özel aile projesi. Kod: MIT.
