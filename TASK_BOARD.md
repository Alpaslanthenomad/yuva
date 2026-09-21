# TASK_BOARD — YUVA

Tek iş listesi. `[ ]` bekliyor · `[~]` yapılıyor · `[x]` bitti (tarih).
Faz tanımları `PROJECT_BLUEPRINT.md §5`.

## Faz 0 — İskelet (2026-09-20)

- [x] Constitution dosyaları (BLUEPRINT / ARCHITECTURE / CLAUDE / TASK_BOARD) — 2026-09-20
- [x] Next.js static export + JSX + saf CSS iskeleti — 2026-09-20
- [x] Design tokens + globals.css (mobil önce, dark mode) — 2026-09-20
- [x] PWA: manifest + sw + ikonlar — 2026-09-20
- [x] Supabase migration 0001: hane, üyeler, takvim, para, plan, aile, görev, alışveriş, bildirim, RLS, trigger, RPC — 2026-09-20
- [x] Seed: varsayılan kategoriler, örnek kurlar — 2026-09-20
- [x] Repository katmanı (contract + demoRepo + supabaseRepo) — 2026-09-20
- [x] Ekranlar: Bugün · Takvim · Para · Planlar · Aile · Ayarlar · Giriş — 2026-09-20
- [x] Hızlı Ekle sayfası (harcama / olay / görev / alışveriş) — 2026-09-20
- [x] lib/money, lib/dates, lib/holidays + birim testleri — 2026-09-20
- [x] CI (GitHub Actions) — 2026-09-20

## Faz 0.5 — İki dillilik (2026-09-21)

- [x] i18n motoru: `lib/i18n/` (tr.js · es.js · index.js · context.jsx), `useT()` hook — 2026-09-21
- [x] Tüm ekran ve bileşenler `useT()` ile bağlandı; JSX'te sabit metin sıfır — 2026-09-21
- [x] Tarihler dile duyarlı (ay/gün adları, göreli etiketler) — 2026-09-21
- [x] Tatil adları çift dilli (🇨🇱 16 + 🇹🇷 7+bayramlar) — 2026-09-21
- [x] Dil seçici: Ayarlar (blok) + Giriş (kompakt); cihaz bazlı, hane varsayılanı — 2026-09-21
- [x] Demo veri iki dilli (Şili İspanyolcası) — 2026-09-21
- [x] Migration 0002: `seed_default_categories(hid, locale)`, `household_members.locale`, `create_household` dil parametresi — 2026-09-21
- [x] `tests/i18n.test.js`: anahtar eşitliği, tip eşitliği, boş çeviri, sabit-metin taraması — 2026-09-21
- [ ] Üye dili Supabase'den okunsun (şu an yalnızca cihazda) — Faz 1
- [ ] Katılım daveti bağlantısı alıcının dilinde açılsın — Faz 2

## Faz 1 — MVP (Şimdi)

- [ ] Supabase projesi aç ("Yuva"), migration'ları uygula, env'i Vercel'e koy
- [ ] Giriş: e-posta magic link; ilk girişte "hane kur / koda katıl" akışı
- [ ] `supabaseRepo` tüm contract metodlarını gerçek sorgularla doldur (şu an iskelet)
- [ ] Takvim: hafta görünümü sürükle-kaydır; RRULE düzenleme UI; çakışma uyarısı
- [ ] Para: işlem düzenleme/silme; filtre (ay/üye/kategori/hesap); rapor grafikleri
- [ ] Para: düzenli kurallar → `post_due_recurring` için Supabase cron (pg_cron) kurulumu
- [ ] Bütçe ekranı: kategori bazlı aylık zarflar + %80/%100 uyarısı
- [ ] Alışveriş: "işaretlileri harcamaya çevir"
- [ ] Planlar: seyahat detay (itinerary + rezervasyon + bavul listesi + bütçe vs gerçek)
- [ ] Aile: belge süreleri + hatırlatma; önemli günler yıllık tekrar
- [ ] Bildirim merkezi (uygulama içi) + sabah özeti RPC
- [ ] Playwright duman testi: giriş → harcama ekle → raporda gör
- [ ] Ailede 1 hafta gerçek kullanım → geri bildirim → eleme

## Faz 2 — Derinlik

- [ ] İşlem bölüşme (split), borç/alacak defteri
- [ ] Harçlık kuralları + görev puanı bağlantısı
- [ ] Fiş/belge fotoğrafı (Storage bucket + policy)
- [ ] Web Push bildirimleri
- [ ] ICS içe/dışa aktarma; "Kim müsait?" boş zaman bulucu
- [ ] Yemek planı + malzeme → alışveriş listesi
- [ ] Notlar & pano
- [ ] Çevrimdışı yazma kuyruğu
- [ ] Net varlık ekranı
- [ ] Plan şablonları

## Faz 3 — Akıllı

- [ ] Telegram bot ile harcama girişi
- [ ] OCR fiş okuma
- [ ] Banka CSV içe aktarma + kural motoru
- [ ] Google Calendar senkron
- [ ] Aylık aile raporu (PDF/e-posta)
- [ ] Çok haneli kullanım

## Backlog / Fikirler

- Konum bazlı hatırlatma
- Evcil hayvan takvimi
- Okul ders programı görünümü
- Hane "geleneksel" takvimleri (bayramlar) için ayrı katman
