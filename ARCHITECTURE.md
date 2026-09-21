# ARCHITECTURE — YUVA

Teknik yapı. Ürün kararları için `PROJECT_BLUEPRINT.md`, çalışma kuralları için
`CLAUDE.md`, iş listesi için `TASK_BOARD.md`.

## 1. Stack (FLOW ile birebir)

| Katman | Seçim | Not |
|--------|-------|-----|
| Frontend | **Next.js (App Router) `output: 'export'`** + React | Statik HTML/JS; herhangi bir CDN'e (Vercel/Netlify/Cloudflare Pages) atılır |
| Dil | **JavaScript / JSX only** | Frontend'de TypeScript yok. JSDoc ile tip ipuçları serbest |
| Stil | **Saf CSS + design tokens** (`styles/tokens.css`) | CSS framework yok, CSS-in-JS yok. Tek `globals.css`, bileşen sınıfları BEM-vari |
| Backend | **Supabase** — Postgres + RLS + trigger + RPC + Auth + Storage | Tüm iş mantığı DB'de. Frontend sadece `select/insert/update` ve `rpc()` çağırır |
| Auth | Supabase Auth (e-posta + magic link; Google OAuth Faz 1) | Çocuklar `auth.users` değildir; `household_members.user_id NULL` |
| Mobil | **PWA** (`manifest.json` + `sw.js`) | Ana ekrana ekle; standalone; app-shell offline |
| Test | Node test runner (`node --test`) + Playwright (Faz 1) | `lib/` saf fonksiyonları birim testli |
| CI | GitHub Actions: `npm ci && npm test && npm run build` | |

## 2. Dizin yapısı

```
yuva/
├─ PROJECT_BLUEPRINT.md   ← ürün anayasası
├─ ARCHITECTURE.md        ← bu dosya
├─ CLAUDE.md              ← AI/insan çalışma kuralları
├─ TASK_BOARD.md          ← iş listesi (tek kaynak)
├─ app/                   ← Next.js App Router (JSX)
│  ├─ layout.jsx          ← kabuk: AppShell + BottomNav + QuickAdd
│  ├─ page.jsx            ← BUGÜN
│  ├─ takvim/page.jsx
│  ├─ para/page.jsx
│  ├─ planlar/page.jsx
│  ├─ aile/page.jsx
│  ├─ ayarlar/page.jsx
│  └─ giris/page.jsx
├─ components/            ← saf UI bileşenleri (durum yok, veri prop'la gelir)
├─ lib/
│  ├─ supabase.js         ← istemci (env yoksa null → demo mod)
│  ├─ data/               ← veri erişim katmanı (repository pattern)
│  │  ├─ index.js         ← `getRepo()` → supabase | demo
│  │  ├─ supabaseRepo.js
│  │  └─ demoRepo.js      ← localStorage üstünde çalışan sahte backend
│  ├─ money.js            ← para/kur/format saf fonksiyonlar (testli)
│  ├─ dates.js            ← tarih/RRULE/tatil saf fonksiyonlar (testli)
│  ├─ holidays.js         ← CL + TR resmi tatil üreteci
│  └─ i18n/tr.js          ← tüm arayüz metinleri (tek dosya, anahtar bazlı)
├─ styles/
│  ├─ tokens.css          ← renk/boşluk/tipografi değişkenleri
│  └─ globals.css
├─ public/
│  ├─ manifest.json, sw.js, icons/
├─ supabase/
│  ├─ migrations/0001_init.sql … ← şema, RLS, trigger, RPC
│  └─ seed.sql            ← varsayılan kategoriler, kurlar
├─ tests/                 ← node --test
└─ docs/                  ← ekran akışları, kararlar
```

## 3. Veri erişim katmanı (repository)

Frontend hiçbir yerde doğrudan `supabase.from()` çağırmaz; `lib/data/index.js`
üzerinden `repo.transactions.list(...)`, `repo.events.create(...)` gibi
metodlar kullanır. İki uygulama vardır:

- `supabaseRepo` — gerçek backend.
- `demoRepo` — `localStorage` üstünde çalışır; `.env` yoksa otomatik devreye
  girer. Amaç: repoyu klonlayan herkes 30 saniyede uygulamayı telefonda görsün;
  ekran tasarımı backend'i beklemesin.

Arayüz sözleşmesi tek yerde (`lib/data/contract.js`, JSDoc). Yeni tablo → önce
migration, sonra contract, sonra iki repo, sonra ekran.

## 4. Veritabanı tasarım kuralları

1. Her iş tablosunda `id uuid pk default gen_random_uuid()`, `household_id`,
   `created_by`, `created_at`, `updated_at` (trigger ile).
2. **Para**: `amount numeric(14,2)` + `currency char(3)` + `fx_rate numeric(18,8)`
   + `amount_base numeric(14,2)` — `amount_base` trigger ile işlem tarihindeki
   kurdan hesaplanır ve sonradan **değişmez** (kur güncellenirse eski kayıtlar
   yeniden hesaplanmaz; gerekirse RPC ile bilinçli yeniden değerleme).
3. **Tarih**: takvim olayları `timestamptz` + `tz text`; tüm-gün olaylar
   `date` alanlarında. Para işlemleri `occurred_on date`.
4. **Tekrar**: RFC 5545 RRULE metni (`rrule text`) + `exdates date[]`.
   Açılım (expansion) frontend'de `lib/dates.js` ile; DB'de "sonraki vade"
   `next_due_on` kolonunda önbelleklenir.
5. **RLS**: `public.is_household_member(hid)` ve `public.is_household_adult(hid)`
   `security definer` fonksiyonları. Okuma: üye; yazma: yetişkin (takvim, görev
   ve alışveriş listesinde misafir de yazabilir).
6. **Silme**: yumuşak silme yok; `activity_log` her insert/update/delete'i
   JSON olarak saklar (geri alma kaynağı).
7. **RPC'ler** (Faz 0'da tanımlı): `create_household`, `join_household`,
   `month_summary`, `budget_status`, `upcoming_agenda`, `post_due_recurring`.

## 5. PWA & çevrimdışı

- `public/sw.js`: app-shell (HTML/CSS/JS) cache-first; API çağrıları network-only.
- Faz 2: yazma kuyruğu (IndexedDB) + Background Sync.
- `manifest.json`: `display: standalone`, `theme_color` token'dan.

## 6. Güvenlik

- Anon key sadece RLS arkasında; `service_role` asla frontend'e girmez.
- Storage bucket'ları (fiş, belge) hane klasörü bazlı policy.
- Hane katılım kodu 8 karakter, tek kullanımlık değil ama yenilenebilir.

## 7. Dağıtım

- `npm run build` → `out/` → Vercel/Netlify/Cloudflare Pages (static).
- Env: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- Supabase migration'ları `supabase db push` veya Studio SQL editöründen sırayla.
