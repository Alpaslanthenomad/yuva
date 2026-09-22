# YUVA — Aile Yönetim Sistemi / Family OS

> **Tek cümle:** Ailenin ortak takvimi, ev muhasebesi ve planlama aracı — telefondan, tek elle, 10 saniyede.
>
> **One sentence:** The family's shared calendar, household ledger and planning tool — phone-first, one-handed, ten seconds per entry.

Bu dosya projenin **anayasasıdır**. Her görev, her oturum, her PR bu dosyaya
referans verir. Değişiklik gerektiğinde önce bu dosya güncellenir, sonra kod.
(Aynı disiplin FLOW'da olduğu gibi: `PROJECT_BLUEPRINT.md` → `ARCHITECTURE.md` →
`CLAUDE.md` → `TASK_BOARD.md`.)

---

## 0. Neden var? (Problem)

Bir aile her gün üç soruyu birden cevaplar ve bunu genelde 4–5 farklı
uygulamada yapar:

| Soru | Bugün nerede cevaplanıyor | Sorun |
|------|---------------------------|-------|
| **Bu hafta kim, ne zaman, nerede?** | Herkesin kendi telefon takvimi, WhatsApp | Çakışmalar, "bana söylememiştin" |
| **Neye ne kadar harcadık?** | Banka uygulaması, kafadan hesap, Excel | Görünmez para, çoklu para birimi kaosu (CLP/TRY/USD) |
| **Neyi planlıyoruz?** | Notlar, grup sohbeti, kafalar | Tatil bütçesi takvimden kopuk, davet listesi harcamadan kopuk |

YUVA bu üç soruyu **tek veri modelinde** birleştirir: bir tatil hem takvim
olayıdır, hem bütçe kalemidir, hem de yapılacaklar listesidir. Bir doğum günü
hem "önemli gün"dür, hem davet planıdır, hem hediye harcamasıdır. **Bağlantı
(link) her yerde:** her harcama bir olaya, her olay bir plana, her plan bir
üyeye bağlanabilir.

## 1. Kullanıcılar ve roller

| Rol | Kim | Ne yapar |
|-----|-----|----------|
| **Yetişkin (adult)** | Ebeveynler, hesaplı büyükler | Her şeyi görür/düzenler; para modülü, ayarlar, üyeler |
| **Çocuk (child) — profil** | Çocuklar (hesapsız) | Takvimde, görevlerde, harçlıkta *özne* olarak yer alır; giriş yapmaz. İleride "sınırlı hesap" olabilir |

Karar: **Yetişkinler hesap açar, çocuklar profildir.** (2026-09-20)

Karar: **Misafir rolü kaldırıldı.** (2026-09-22) Uygulama yalnızca hanenin
kendi üyeleri için; bakıcı gibi dışarıdan biri senaryosu yok. Üç rollü model
gereksiz karmaşıklık ve sızıntı yüzeyiydi — dış incelemede misafirin ajanda
üzerinden ödeme tutarlarını görebildiği bulunmuştu. Artık giriş yapabilen
her üye yetişkin olduğu için "misafir para göremez" şartı yapısal olarak
sağlanıyor, kontrol edilecek bir durum kalmıyor.

## 2. Tasarım ilkeleri (değişmez)

1. **Telefon önce, tek el.** Başparmak bölgesi: alt sekme çubuğu + sağ altta
   "Hızlı Ekle" (+). Masaüstü aynı arayüzün geniş halidir, ayrı ürün değildir.
2. **10 saniye kuralı.** Bir harcama, bir olay veya bir görev en fazla üç
   dokunuşla girilir. Varsayılanlar akıllıdır (son hesap, son kategori, bugün).
3. **Her şey bağlanır.** `transactions.event_id`, `transactions.trip_id`,
   `calendar_events.trip_id`, `tasks.event_id`… Raporlar bu bağlardan doğar.
4. **Çoklu para birimi doğal.** Her kayıt kendi para biriminde girilir
   (CLP / TRY / USD / EUR), rapor **ana para biriminde** (hane ayarı) okunur.
   Kur, işlem tarihindeki kurdur; sonradan değişmez (muhasebe doğruluğu).
5. **İş mantığı Supabase'de.** RLS, trigger, RPC. Frontend "aptal" kalır
   (FLOW ilkesi). Static export → CDN'e atılır, PWA olarak telefona kurulur.
6. **Çevrimdışı okunabilir.** Son senkron verisi cihazda; giriş yapılamazsa
   da bu haftanın takvimi görünür. Yazma, bağlantı gelince kuyruklanır (Faz 2).
7. **Sessiz ama hatırlatır.** Bildirim spam'i yok; günde bir "sabah özeti"
   + kritik hatırlatmalar (fatura vadesi, pasaport süresi, doğum günü 7 gün önce).
8. **İki dilli: Türkçe + İspanyolca (Şili).** Dil **kişi başınadır**, hane
   başına değil: aynı evde bir kişi Türkçe, bir başkası İspanyolca kullanabilir,
   veri ortaktır. Yeni üye hanenin varsayılan diliyle başlar, istediğinde
   değiştirir. Varsayılan kategoriler hane kurulurken seçilen dilde oluşur.
   Resmi tatiller: 🇨🇱 Şili + 🇹🇷 Türkiye (hane ayarından seçilir), adları
   arayüz diline göre gösterilir. Saat dilimi hane bazlı, olay bazlı override var.

## 3. Modül haritası (tam liste — eleme sonradan)

Aşağıdaki liste **her şeyi** içerir. `MVP` işaretliler ilk sürümde; diğerleri
faz numarasıyla. Kullanıcı eleme yaptıkça bu tablo güncellenir.

### 3.1 BUGÜN (Ana ekran) — `MVP`
- Günün ajandası (tüm üyeler, renk kodlu)
- "Bu hafta" şeridi: 7 gün, yoğunluk noktaları
- Para nabzı: bu ay harcanan / bütçe, en büyük 3 kategori
- Yaklaşan önemli günler (7 gün), vadesi gelen faturalar, süresi dolan belgeler
- Bugün bitmesi gereken görevler + alışveriş listesi sayacı
- Hızlı Ekle (+): Harcama · Olay · Görev · Alışveriş · Not

### 3.2 TAKVİM — `MVP`
- Görünümler: Gün / Hafta / Ay / Ajanda (liste)
- Üye filtresi (herkes / sadece ben / seçili üyeler), renk kodu üye bazlı
- Kategoriler: İş · Okul · Sağlık randevusu · Sosyal · Spor · Seyahat · Ev · Diğer
- Tekrarlayan olaylar (RRULE), istisna günler
- Katılımcılar (üyeler) + dış davetli notu
- Hatırlatma (dk/saat/gün önce), konum, not, ek (link)
- **Çakışma uyarısı**: aynı üye, örtüşen saat
- **"Kim müsait?"** — seçili üyeler için boş zaman bulucu (Faz 2)
- Resmi tatiller (CL + TR) katmanı, okul tatilleri katmanı (elle girilen dönem)
- ICS dışa/içe aktarma (Faz 2), Google Calendar tek yönlü içe alma (Faz 3)
- Olay → Plan bağlantısı (bu olay "İzmir tatili" planına ait)

### 3.3 PARA — `MVP`
**Kayıt**
- İşlem türleri: Gider · Gelir · Transfer (hesaplar arası)
- Hesaplar: Nakit · Banka · Kredi kartı · Birikim · Yatırım — her biri tek para biriminde
- Kategoriler (2 seviye): Market › Gıda, Ev › Kira, Ulaşım › Yakıt… hane bazlı düzenlenebilir
- Kim ödedi / kim için (üye) — çocuk harcamaları çocuk profiline bağlanır
- Etiketler (#tatil2026, #vergi), not, fiş fotoğrafı (Faz 2: Storage)
- Bölüşme: bir işlem birden çok üyeye/kategoriye bölünür (Faz 2)
- Bir işlemi bir olaya/plana bağla

**Düzenli / Abonelikler**
- Fatura ve abonelik kuralları (Netflix, kira, okul taksidi): tutar, periyot, hesap, kategori
- Vade hatırlatması (N gün önce), "otomatik işle" seçeneği
- Yaklaşan vadeler listesi, aylık sabit gider toplamı

**Bütçe**
- Aylık kategori bütçeleri (zarf yöntemi), devretme (rollover) seçeneği
- Bütçe durumu: harcanan / kalan / gün başına kalan
- Aşım uyarısı (%80, %100)

**Çoklu para birimi**
- Hane ana para birimi (varsayılan CLP), `fx_rates` tablosu (günlük; elle veya API ile)
- İşlem anında `amount_base` hesaplanır ve **dondurulur**
- Raporda "orijinal para biriminde göster" anahtarı

**Raporlar**
- Aylık: kategori dağılımı, geçen ay karşılaştırması, üye bazlı
- Trend: son 12 ay gelir/gider/tasarruf oranı
- Sabit vs değişken gider
- Net varlık (hesap bakiyeleri + birikim − borç) (Faz 2)
- Plan bazlı: "İzmir tatili toplam maliyeti" (bağlı işlemlerden)
- CSV dışa aktarma; banka CSV içe aktarma (Faz 3)

**Borçlar & alacaklar** (Faz 2)
- Kişilere borç/alacak defteri, taksitli kredi takibi

**Harçlık (çocuklar)** (Faz 2)
- Üye bazlı harçlık kuralı (haftalık/aylık), harçlık defteri
- Görev puanı → harçlık bonusu bağlantısı

### 3.4 PLANLAR — `MVP (temel)`
Bir "plan" = tarih aralığı + bütçe + kontrol listesi + bağlı olaylar/işlemler.
Türleri:
- **Seyahat / Tatil**: destinasyon, tarih, kişiler; itinerary (gün gün), rezervasyonlar
  (uçuş/otel/araç: onay kodu, tutar, link), bavul listesi, belge kontrolü
  (pasaport süresi!), bütçe vs gerçekleşen
- **Davet / Kutlama** (doğum günü, yemek, misafir): davetli listesi + LCV (RSVP) + kişi sayısı,
  menü/alışveriş listesi, bütçe, görev dağılımı
- **Proje** (ev tadilatı, taşınma, araba alımı): aşamalar, bütçe, tedarikçi notları (Faz 2)
- **Birikim hedefi**: hedef tutar, tarih, bağlı hesap, ilerleme çubuğu; katkılar
- Plan şablonları: "Hafta sonu kaçamağı", "Doğum günü partisi", "Yurt dışı seyahat" (Faz 2)

### 3.5 AİLE — `MVP (temel)`
- **Üyeler**: isim, renk, avatar, rol, doğum tarihi (→ otomatik doğum günü kaydı)
- **Önemli günler**: doğum günü, yıldönümü, anma, özel gün; yıllık tekrar; N gün önce hatırlat;
  hediye fikirleri notu; geçmiş hediyeler (harcama bağlantısı)
- **Kişiler / Rehber**: akraba, doktor, okul, tamirci; ilişki; telefon; not (Faz 2)
- **Belgeler & süreler**: pasaport, kimlik, ehliyet, sigorta, kira sözleşmesi, araç muayenesi,
  vize — **son kullanma tarihi + hatırlatma**; dosya eki (Storage, Faz 2)
- **Ev & araç bakımı**: periyodik bakım kayıtları (kombi, araç servisi, filtre) (Faz 2)
- **Okul**: ders programı, dönem/tatil tarihleri, veli toplantıları (Faz 2)
- **Sağlık randevuları**: sadece randevu/aşı *takvimi* (tıbbi içerik tutulmaz) (Faz 2)
- **Evcil hayvan**: aşı/veteriner takvimi (Faz 3)

### 3.6 GÖREVLER (Ev işleri) — `MVP (temel)`
- Görev: başlık, atanan üye, vade, tekrar (her Pazartesi), puan, kategori
- Çocuklar için puan tablosu; haftalık "yıldız" özeti (Faz 2 harçlık bağlantısı)
- Bir plana/olaya bağlı görevler ("Parti öncesi: balonları al")

### 3.7 ALIŞVERİŞ LİSTESİ — `MVP`
- Ortak liste(ler): market, eczane, bauhaus…
- Ekle / işaretle / sil; kim ekledi; tahmini fiyat
- "Listeyi harcamaya çevir": işaretlileri tek işlem olarak Para'ya yaz
- Sık alınanlar önerisi (Faz 2)

### 3.8 YEMEK PLANI — `Faz 2`
- Haftalık menü (öğle/akşam), tarif linki, malzemeleri alışveriş listesine at

### 3.9 NOTLAR & PANO — `Faz 2`
- Ortak notlar (wifi şifresi, kapıcı numarası), sabitlenmiş duyurular, dosya ekleri

### 3.10 BİLDİRİMLER — `MVP (temel: uygulama içi) / Faz 2 (push)`
- Uygulama içi bildirim merkezi
- Web Push (PWA): sabah özeti, vade/süre/doğum günü hatırlatmaları
- Kanal tercihleri üye bazlı

### 3.11 AYARLAR — `MVP`
- Hane: ad, ana para birimi, saat dilimi, ülke takvimleri, hafta başlangıcı
- Üyeler & davet (katılım kodu), roller
- Hesaplar, kategoriler, para birimleri & kurlar
- Veri: CSV dışa aktarma, hane silme

### 3.12 İLERİ FAZ FİKİRLERİ — `Faz 3+`
- Telegram/WhatsApp bot: "market 45.000" yaz → harcama düşsün
- Fiş fotoğrafından OCR ile tutar/kategori önerisi
- Banka CSV/OFX içe aktarma, kural tabanlı otomatik kategori
- Google Calendar / Apple Calendar iki yönlü senkron
- Aylık "aile toplantısı" raporu (PDF/e-posta)
- Konum bazlı hatırlatma ("markete yakınken listeyi göster")
- Çok haneli kullanım (Şili evi / Türkiye evi ayrı haneler, tek hesap)

## 4. Veri modeli (özet — ayrıntı `ARCHITECTURE.md` ve `supabase/migrations/`)

```
households ─┬─ household_members ──(user_id?)── auth.users / profiles
            ├─ calendar_events ── event_attendees
            ├─ accounts ── transactions ──┬─ categories
            │                              ├─ recurring_rules
            │                              └─ (event_id | plan_id | for_member_id)
            ├─ budgets (period × category)
            ├─ fx_rates
            ├─ plans ──┬─ plan_items (itinerary | booking | checklist | guest)
            │          └─ goal_contributions
            ├─ occasions (önemli günler)
            ├─ documents (süreli belgeler)
            ├─ tasks
            ├─ shopping_lists ── shopping_items
            ├─ notifications
            └─ activity_log
```

Tüm tablolar `household_id` taşır; RLS `is_household_member(household_id)`
üzerinden çalışır; para tablolarında ek olarak `is_household_adult()`.

## 5. Fazlar

| Faz | Kapsam | Çıktı |
|-----|--------|-------|
| **0 — İskelet** (bu repo) | Constitution dosyaları, şema, PWA kabuğu, 5 ana ekran, demo veri | `npm run build` geçer, telefonda kurulur |
| **1 — MVP** | Supabase bağlantısı canlı, giriş, hane kur/katıl, Takvim + Para + Alışveriş tam; Planlar/Aile temel | Aile 1 ay gerçek kullanır |
| **2 — Derinlik** | Bütçe devri, bölüşme, harçlık, belgeler+Storage, yemek planı, push, ICS | "Excel'i kapattık" |
| **3 — Akıllı** | Bot ile giriş, OCR, banka içe aktarma, takvim senkron, aylık rapor | "Uygulama bizi yönetiyor" |

## 6. Başarı ölçütleri

- Harcama girişi ortalama < 10 sn (telefon, tek el)
- Haftada en az 5 gün açılıyor (her iki yetişkin)
- Ay sonunda "neye ne kadar harcadık?" sorusu 1 ekranda, tartışmasız cevaplanıyor
- Hiçbir fatura/belge süresi kaçmıyor (hatırlatma ≥ 7 gün önce)

## 7. Karar günlüğü

- 2026-09-20 — Proje başladı. Stack FLOW ile aynı. CLP+TRY+USD+EUR; yetişkin hesap / çocuk profil; GitHub: Alpaslanthenomad/yuva.
- 2026-09-21 — Arayüz **iki dilli** yapıldı: Türkçe + İspanyolca (Şili varyantı).
  Dil kişi başına saklanır (cihazda), hane yalnızca varsayılanı belirler —
  gerekçe: Şili'de yaşayan Türk ailede ev halkı ve çevre farklı dil konuşuyor;
  dili haneye bağlamak bir kişiyi yanlış dile mahkûm ederdi.
  Kullanıcının girdiği veri (kategori adı, olay başlığı, not) **çevrilmez**;
  yalnızca arayüz metinleri, tarihler ve tatil adları dile duyarlıdır.

- 2026-09-21 — Dış inceleme sonrası **doğruluk turu** (migration 0006–0009).
  Para hesapları düzeltildi: toplam bütçe satırı harcamayı 0 gösteriyordu
  (NULL kategori hiçbir harcamayla eşleşmiyordu), aynı döneme birden fazla
  toplam bütçe girilebiliyordu (Postgres UNIQUE'inde NULL'lar farklı sayılır),
  sabit/değişken gider hiç hesaplanmıyordu, plan harcaması gelir ve transferleri
  de topluyor ve her işlemi güncel kurla yeniden çeviriyordu.
  **Karar: tutarlar işlem anında dondurulan `amount_base` üzerinden okunur**,
  ön yüz kur hesabı yapmaz — geçmiş maliyet kur oynadıkça değişmemeli.
- 2026-09-21 — **Para yalnızca yetişkine** (migration 0007). Blueprint bunu
  zaten söylüyordu ama RLS şablonu finansal tabloları tüm üyelere açıyordu;
  üstelik `security definer` RPC'ler RLS'i atlıyordu. Kural tek fonksiyonda
  toplandı (`can_see_money`) — gerekçe: ileride 'teen' gibi bir rol eklenirse
  tek yerden değişsin. Katılım kodu da **süreli + kullanım sınırlı + rol
  taşıyan** hale getirildi; eskiden kodu bilen herkes onay beklemeden yetişkin
  oluyordu.
- 2026-09-21 — **Tekrarlayan olayda tek gün** `exdates`'e yazılır (0008); seri
  silinmez. RPC olarak yazıldı — diziyi ön yüzden oku-değiştir-yaz yapmak iki
  kişi aynı anda dokunduğunda birinin değişikliğini yok ediyordu.
- 2026-09-21 — **Canlı yenileme** Supabase Realtime ile (0009). Tablolara
  `replica identity full` verildi; varsayılanda DELETE olayı yalnızca birincil
  anahtarı taşıdığı için `household_id` süzgeci silmeleri yakalamıyor ve
  silinen satır diğer cihazda ekranda kalıyordu. Olaylar 400 ms'de tek
  yenilemeye indirilir; hane/üye/hesap/kategori değişince kabuk verisi de
  yeniden yüklenir.
- 2026-09-22 — **Tekrar kuralı vadeye çapalanır** (`buildRRule`, lib/dates.js).
  Görev formuna tekrar seçeneği eklenirken karar: "her ay" seçilince kurala
  `BYMONTHDAY` yazılır. Gerekçe, olay ile görevin farklı çalışması: olay serisi
  her seferinde kendi başlangıç tarihinden açılır, görev ise her tamamlanışta
  **yeni vadesinden** devam eder. Çapa kuralda olmazsa 31 Ocak → 28 Şubat'a
  kırpılınca seri kalıcı olarak 28'e düşer. Olay formu da aynı yardımcıyı
  kullanıyor — iki ayrı tekrar mantığı taşımamak için.
- 2026-09-22 — **Tekrarlayan görevde geri alma ayrı bir eylem.** Onay kutusu
  tekrarlayan görevde bitmiş göstermez (görev bitmez, vadesi taşınır), bu yüzden
  ikinci tıklama geri alma değil ikinci bir tamamlama oluyordu. Geri alma satır
  altında açık bir düğme; "kutuyu tekrar tıkla" davranışı kasıtlı olarak yok.
- 2026-09-22 — **Kaçırılan değişiklikler için tam yenileme.** Realtime yalnızca
  kanal açıkken duyar; uyuyan telefonda veya arka plandaki sekmede olan biten
  geri dönünce kendiliğinden gelmiyordu. Kanal yeniden kurulduğunda ve
  çevrimdışından dönüşte zorunlu, sekmeye dönüşte 15 sn eşiğiyle yeniden
  yükleme yapılır. Eşik olmasa her sekme değişiminde sunucuya gidilirdi.
- 2026-09-22 — **Sabah özeti kişiye özel** (0017). Bildirim tablosu ve RLS
  bunu 0001'den beri destekliyordu (`member_id` dolu = yalnızca o üye görür);
  eksik olan yazan taraftı. Katılımcısı yazılmamış olay ve kimseye atanmamış iş
  **herkese** sayılır — aksi halde hanenin ortak işleri kimsenin özetine
  girmezdi.
