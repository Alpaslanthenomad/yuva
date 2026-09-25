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

### Doğruluk düzeltmeleri (dış inceleme sonrası) — 2026-09-21

- [x] `expandRRule`: BYDAY'siz haftalık tekrar hafta başına kayıyordu (Çarşamba → Pazartesi); artık kendi gününde tekrar ediyor — 2026-09-21
- [x] Depo kökündeki 37 mükerrer dosya kaldırıldı — 2026-09-21
- [x] Migration 0006 yazıldı: toplam bütçe harcaması, bütçe tekilliği, sabit/değişken gider, katkılarda dondurulmuş kur, `budget_set` RPC — 2026-09-21
- [x] `planTotals`: plan harcaması yalnızca giderlerden ve dondurulmuş `amount_base` ile hesaplanıyor (gelir/transfer artık sayılmıyor) — 2026-09-21
- [x] Migration 0006 canlı veritabanına uygulandı ve doğrulandı — 2026-09-21
- [x] Migration 0007 yazıldı: finansal tablolarda okuma yalnızca yetişkine; month_summary/budget_status/today_snapshot/app_bootstrap aynı sınırı uyguluyor; app_bootstrap hesapları ve katılım kodunu artık misafire vermiyor — 2026-09-21
- [x] Katılım kodu sertleştirildi: süre + kullanım hakkı + hangi rolle katılınacağı; `rotate_join_code` RPC ve Ayarlar'da 'Yeni kod üret' — 2026-09-21
- [x] Migration 0007 canlı veritabanına uygulandı ve doğrulandı; hane kodu `6C69FFC6` rol=adult · 1 kullanım · 2026-10-22'ye kadar geçerli — 2026-09-21
- [x] Tekrarlayan olayda tek günü atlama: migration 0008 (`event_skip_occurrence`), Takvim'de "Yalnızca bu gün" / "Tüm seri" seçimi; canlıya uygulandı — 2026-09-21
- [x] Cihazlar arası canlı yenileme: migration 0009 (18 tablo yayında, `replica identity full`), `repo.subscribe` + AppShell'de 400 ms'lik toplama; canlıya uygulandı — 2026-09-21
- [x] Tekrarlayan görevler: migration 0010 (`task_completions` + tamamla/geri al/ertele/atla RPC'leri), `nextOccurrence()` yardımcısı, Aile'de satıra dokununca açılan eylemler, haftalık puan artık tamamlama kaydından; canlıya uygulandı — 2026-09-22
- [x] Bugün ekranı önceliklendirildi: Bugün / Bekleyen işler / Sıradaki 7 gün sırası; geciken görev ayrı gösteriliyor (kaç gün geciktiğiyle), görev tamamlamada "Geri al", bildirimler tek satıra katlandı, hafta şeridi 7 gün kartına taşındı, para kartı aşağı indi — 2026-09-22
- [x] Plan–takvim bağı: plan tarihleri takvimde ve Bugün ekranında bant olarak görünüyor ("5. gün / 22"), tıklayınca Planlar'a gidiyor. Kopya olay yazılmıyor — tek kaynak `plans`. Birikim hedefleri banda girmiyor — 2026-09-22
- [x] Tam yedek: `export_household` RPC (migration 0012), Ayarlar'da tek düğmeyle 19 bölümlük JSON iniyor; tarayıcıda uçtan uca denendi (118 kayıt) — 2026-09-22
- [x] Yedekten geri yükleme (`import_household`, migration 0018) — 2026-09-22
- [x] Bağlantı durumu şeridi: çevrimdışıyken ve Realtime kanalı kopukken uyarı çıkıyor, sağlıklıyken hiçbir şey gösterilmiyor; tarayıcıda çevrimdışı simüle edilerek denendi — 2026-09-22
- [x] Bildirim merkezi + sabah özeti: `post_morning_digest` her sabah 07:00'de (Santiago) günün özetini yazıyor — söyleyecek bir şey yoksa bildirim üretmiyor; Bugün'de geçmiş listesi ve "tümünü okundu işaretle" (migration 0013) — 2026-09-22
- [x] **Hata düzeltme:** tekrarlayan görevde "Geri al" vadeyi geri almıyordu; görev gelecek haftaya kaçmış kalıyordu. Tamamlama kaydı artık önceki vadeyi saklıyor (migration 0014) — 2026-09-22
- [x] **Hata düzeltme:** aylık görev 31 Ocak → 28 Şubat'tan sonra 28'e takılıp kalıyordu. `BYMONTHDAY` çapası eklendi; `-1` "ayın son günü" — 2026-09-22

### Dış incelemenin açık bıraktıkları (2026-09-22, ikinci tur — 7/10)

- [x] **Misafir rolü kaldırıldı** (migration 0015). Giriş yapabilen her üye artık yetişkin; "misafir para göremez" şartı yapısal olarak sağlanıyor, ajanda ve katılım kodu sızıntıları da bu yüzden kapandı — 2026-09-22

- [x] Hızlı eklemede liste kimliği: `shopping_add_item` RPC'si varsayılan listeyi DB'de çözüyor; Bugün ekranı, "+" menüsü ve liste içi aynı davranıyor (migration 0016) — 2026-09-22
- [x] "Alışverişi harcamaya çevir" tek işlemde: `shopping_checkout` harcamayı yazıp işaretlileri aynı transaction'da siliyor; çift kayıt riski kapandı (migration 0016) — 2026-09-22
- [x] Görev formuna tekrar seçeneği eklendi. Kural vadeye çapalanıyor: "her ay" + vade ayın 31'i → `FREQ=MONTHLY;BYMONTHDAY=31`, yani seri şubattan sonra 31'e geri dönüyor. Olay formu da aynı yardımcıları kullanıyor (`buildRRule` / `freqKeyOf`, lib/dates.js) — 2026-09-22
- [x] **Hata düzeltme:** Aile › Görevler'de tekrarlayan görevi geri almanın yolu yoktu. Görev "bitti" olmadığı için onay kutusu hemen boşalıyor, ikinci tıklama geri alma değil ikinci bir tamamlama oluyordu — vade bir tekrar daha ileri kaçıyordu. Tamamlayınca satırda "Yapıldı / Geri al" çıkıyor. `demoRepo` de `prev_due_on`'u saklayıp geri alıyor (0014 ile aynı davranış) — 2026-09-22
- [x] Plan düzenleme: detay sayfasında ⚙️ sekmesi — başlık, yer, tarihler, bütçe/hedef, para birimi ve durum. Tür düzenlemede değişmiyor (bütçe/hedef alanı ve ikon türe bağlı) — 2026-09-22
- [x] Hedefe katkı ekleme: hedef planlarda 🐖 sekmesi — tutar, para birimi, tarih, not; ilerleme/hedef/kalan üstte. Kur katkı anında DB'de donuyor (0006), ön yüz göndermiyor — 2026-09-22
- [x] Sabah özeti artık kişiye özel (migration 0017). Randevu = katılımcısı olduğun + katılımcısı hiç yazılmamış olaylar; iş = sana atanmış + kimseye atanmamış. Belge ve özel gün hane geneli. Yalnızca hesabı olan üyeye yazılıyor — çocuk profillerinin hesabı yok. Gerçek veritabanında geri alınan bir işlemde doğrulandı: eşin geciken işi benim sayıma girmiyor — 2026-09-22
- [x] Yeniden bağlanınca tam yenileme: kanal koptuktan sonra yeniden kurulduğunda, çevrimdışıdan dönünce ve sekmeye geri dönünce (15 sn eşikle) kabuk verisi baştan yükleniyor. Kanal kapalıyken yapılan değişiklikler kendiliğinden gelmiyordu, ekran sessizce eskiyordu. Demo kipinde de sekmeler artık birbirini görüyor — 2026-09-22
- [x] Yedekten geri yükleme (migration 0018). Geri yükleme HİÇBİR ŞEYİN üzerine yazmaz: yedek yeni bir hane olarak açılır, mevcut hane olduğu gibi kalır. Sütunlar elle yazılmıyor; `jsonb_populate_record` ile tablonun kendi satır tipine çevriliyor, yalnızca kimlik ve bağlantılar üzerine yazılıyor. Kur yedekteki gibi donmuş kalıyor. Ayarlar'a hane değiştirme kartı da eklendi — onsuz geri yükleme tek yönlü bir kapı olurdu — 2026-09-22
- [x] **Hata düzeltme:** `rotate_join_code` (0015) çalışma anında patlıyordu — `gen_random_bytes` `extensions` şemasında, fonksiyonun search_path'i ise yalnızca `public` idi. Ayarlar'daki "Yeni kod üret" düğmesi her seferinde hata veriyordu. Geri yüklemeyi denerken ortaya çıktı — 2026-09-22
- [x] **Hata düzeltme (en can sıkıcısı):** Açılış çağrısı herhangi bir sebeple patlayınca oturum da düşürülüyor ve kullanıcı GEÇERLİ OTURUMU VARKEN şifre ekranına atılıyordu. Telefonda ağ bir saniye kesilse yetiyordu. Karar `lib/authState.js`'e taşındı ve testlendi: şifre ekranı yalnızca oturum yokken. Oturum varken yüklenemezse "tekrar dene" çıkıyor. Giriş sayfası da bu durumda hane KURMA formunu göstermiyor — gösterseydi ikinci bir hane kurulup veri ikiye bölünebilirdi — 2026-09-22
- [ ] Kritik akışlar test dışı: işlem düzenleme/silme, belge süresi hatırlatması
- [x] Çevrimdışı OKUMA katmanı: `app_bootstrap` ve `today_snapshot` yanıtları kullanıcı başına önbelleğe yazılıyor; sunucuya ulaşılamazsa son hâl gösteriliyor ve üstte ne zaman alındığını söyleyen bir şerit çıkıyor. Yetki hatasında önbelleğe DÜŞÜLMÜYOR (yoksa kullanıcı görmemesi gereken veriyi görmeye devam ederdi). Çıkışta önbellek siliniyor — 2026-09-22
- [ ] Çevrimdışı YAZMA kuyruğu — **bilerek yapılmadı.** İş mantığı veritabanında (tetikleyici, RPC, RLS); sonradan oynatılan bir kuyruk iki kişi aynı anda dokunduğunda çakışır ve parada sessizce çift kayıt üretir. Yarım çalışan kuyruk hiç olmamasından kötü: kullanıcı kaydettiğini sanır. Yazma hâlâ engelli ve bu açıkça söyleniyor. Gerçekten gerekirse ayrı bir iş olarak, çakışma kuralları önce kararlaştırılarak yapılmalı

- [x] Supabase projesi `yuva` (sa-east-1) açıldı; 0001a/0001b/0002/0003 uygulandı; kurlar tohumlandı — 2026-09-21
- [x] `account_balances` view'i `security_invoker` yapıldı (RLS'i atlıyordu) — 2026-09-21
- [x] `budget_status` içindeki hatalı virgüllü JOIN düzeltildi (derlenmiyordu) — 2026-09-21
- [x] Migration 0003: RPC yetkileri sertleştirildi; `post_due_recurring` anon'a kapatıldı — 2026-09-21
- [x] Vercel ortam değişkenleri çalışıyor (site demo değil, gerçek Supabase kipinde açılıyor). Auth Site URL yalnızca e-posta bağlantısı için gerekiyordu; magic link kaldırıldığı için konu dışı — 2026-09-22
- [ ] İlk gerçek hane kurulumu ve eşin katılım kodu ile girişi
- [x] Giriş **e-posta + şifreye** çevrildi; magic link kaldırıldı — 2026-09-21
- [x] Ayarlar › Şifre değiştirme — 2026-09-21
- [x] İlk hane kuruldu ("Bizim Ev", CLP, TR); 52 kategori tohumlandı — 2026-09-21
- [ ] Supabase: "Confirm email" — artık zorunlu değil. Kapalı değilse eş kayıt olduktan sonra hesabı veritabanından onaylı işaretlenebiliyor
- [x] İlk kullanım deneyimi: boş hanede tek yönlendirme kartı; boş kartlar çizilmiyor — 2026-09-21
- [x] Açılış hızı: 10 istek → 2 (`app_bootstrap` + `today_snapshot`, migration 0004).
      Oturum açıkken yenileme ~8 sn → ~1 sn — 2026-09-21
- [x] Yükleniyor yazısı yerine kart iskeleti — 2026-09-21
- [x] Alt menü emoji → çizgi ikon; `+` butonu içeriğin üstüne binmiyor;
      Para sekmeleri kaydırılabilir; "Üyeye göre" boş durumu — 2026-09-21
- [x] Aile: üye düzenleme + haneden çıkarma (soft delete) — 2026-09-21
- [x] Vercel Authentication kapatıldı — eş siteyi açabiliyor. Hobby planında ara yol yoktu: özel alan adı olmadığı için "Standard Protection" de `*.vercel.app` adresini koruyordu, Password Protection ise ücretli. Site artık adresi bilene açık; veriyi uygulamanın kendi girişi ve RLS koruyor. Hesaba girili olmayan bir tarayıcıdan doğrulandı: karşılama + giriş ekranı geliyor — 2026-09-22
- [ ] `supabaseRepo` kalan contract metodlarını gerçek sorgularla doldur
- [ ] Takvim: hafta görünümü sürükle-kaydır; RRULE düzenleme UI; çakışma uyarısı
- [x] Para: işlem düzenleme ve silme — 2026-09-22
- [x] Alışverişte yazmadan sepet: 8 reyon, 85 ürün, emoji ızgarası; dokunma açma/kapama. Markette işaretlenmiş kalem ızgarada solgun ve kilitli — buradan düşürmek markette unutmak demekti. "Süt (2 L)" gibi parantezli miktarlar katalogdaki "Süt" ile eşleşiyor, yoksa liste ikinci bir Süt ile çoğalıyordu — 2026-09-22
- [x] Alışveriş: 12 reyon (meyve/sebze ayrı, atıştırmalık, donuk, kişisel bakım eklendi), 93 ürün. **Sık alınanlar** sekmesi elle yıldızlanmıyor, ekledikçe sayılıyor (migration 0019) — elle kurulum kimse yapmaz, sayaç kendiliğinden doğrulanır — 2026-09-22
- [x] Harcamada hazır seçimler: tutarı yaz, Uber/Taksi/Metro/Otobüs/Uçak/Benzin/Otopark/Restoran… simgesine dokun; "nereye" ve kategori birlikte dolar. Kategori desenle eşleşiyor (hane adları dile göre değişiyor); eşleşme yoksa boş kalıyor — yanlış kategori sessizce bütçeyi bozar — 2026-09-22
- [x] Para: filtre tamamlandı — üye ve kategoriye hesap ve tür (gelir/gider/transfer) eklendi; toplam filtreye göre hesaplanıyor. Transfer, hem kaynak hem hedef hesabın filtresinde görünüyor — 2026-09-25
- [x] **Hata düzeltme:** hesap filtresi gerçek kipte hiçbir şey yapmayacaktı. `account_balances` görünümünde anahtar `account_id`; `id` yok. demoRepo ikisini birden döndürdüğü için demo kipinde çalışıyor, Supabase kipinde bütün seçeneklerin değeri boş kalıyordu. Tarayıcı denemesinde yakalandı — 2026-09-25
- [x] **Hata düzeltme (en uzun süre fark edilmeyeni):** telefondaki uygulama günlerce kendini yenilemiyordu — üç gün önce yayınlanan alışveriş ızgarası bile görünmüyordu. Yayın tarafı sapasağlam olduğu için hata görünmezdi. Sebep: tarayıcı güncellemeye bakarken yalnızca `sw.js` dosyasını karşılaştırıyor, o dosya ise yayından yayına değişmiyor; ana ekrana eklenmiş uygulama açılınca sayfa baştan yüklenmediği için eski kopya çalışmaya devam ediyordu. **Kayıt adresine sürüm eklemek yetmedi** (çalışan sayfa eski kodu taşıdığı için kendi adresini değiştiremiyor — tarayıcıda denenip başarısız oldu). Çözüm: derleme sonrası `out/version.json` yazılıyor, uygulama açılışta ve öne her gelişte oraya sorup kendi kimliğiyle karşılaştırıyor, farklıysa önbelleği temizleyip bir kez yeniliyor. Her sürüm için YALNIZCA BİR KEZ — sunucu yanlış bilgi verse bile telefon sonsuz döngüye girmiyor; ikisi de tarayıcıda denendi — 2026-09-25
- [x] Ayarlar'da **sürüm satırı**: hangi derlemenin çalıştığı yazıyor. Telefonun güncel olup olmadığını tahmin etmeye çalışmak günler kaybettirdi — 2026-09-25
- [x] **CI Actions kotası:** depo private iken `on: [push, pull_request]` her push'ta tam bir çalışma başlatıyordu; 5 günde 30 çalışma, kota tükendi ve 22 Eylül'den beri işler başlayamadan düşüyordu. Push tetikleyicisi kaldırıldı; depo public yapılınca geri açıldı. `paths-ignore`, `concurrency` ve 10 dakikalık sınır kalıcı — 2026-09-25
- [x] **Açık / Koyu kip seçimi** (Ayarlar › Görünüm). Uygulama yalnızca cihazın ayarını takip ediyordu: telefonu koyu kipte olan biri uygulamayı açık kipte göremiyordu, görebilmek için telefonun tamamını değiştirmesi gerekiyordu. Seçim `<html data-theme>` olarak yazılıyor; `<head>` içinde, boyamadan önce çalışan küçük bir betik sayesinde açılışta beyaz parlama olmuyor. Sistem seçiliyken telefon akşam koyuya dönerse uygulama da dönüyor. Koyu renkler tokens.css'te iki blokta (biri cihaz ayarı, biri açık seçim) — ikisinin aynı kalması testle güvence altında, çünkü biri güncellenip diğerinin unutulması yalnızca tek kipte görünen bir renk hatası üretirdi — 2026-09-25
- [x] Para › **Rapor** sekmesi: 3/6/12 aylık eğilim (migration 0020 `month_trend`), gelir–gider çubukları tek ölçekte, aya dokununca o ayın rakamları, aylık ortalama ve en çok harcanan 8 kalem (üst kategoride toplanmış, her birinin mini serisi ve yön oku). Hareketsiz ay da çiziliyor: grafik boş ayı atlarsa iki dolu ay yan yana gelir ve olmayan bir artış gösterir. Kütüphane yok, saf CSS — 2026-09-25
- [x] **Hata düzeltme:** rapor kartı kendi kendisiyle çelişiyordu. "5 aylık ortalama" yazarken altındaki ok, içinde boş aylar olan bir tabana göre %397 artış gösteriyordu. Ortalama hanenin ilk hareketinden itibaren sayılıyordu ama "ortalamaya göre" oku tüm pencereyi kullanıyordu. Artık üçü de (ortalama, ok, kategori yönü) aynı pencereden — `activeMonths` — 2026-09-25
- [x] "Hepsi" ile "Herkes" ayrıldı: kategori, hesap, tür ve plan türü filtrelerinde Türkçe "Herkes" yazıyordu — 2026-09-25
- [x] Para: pg_cron her gün 12:00 UTC (≈ Santiago 09:00) `post_due_recurring` çalıştırıyor; fonksiyon artık gecikmiş dönemleri tek seferde yakalıyor, otomatik giderde her dönem için ayrı işlem yazıyor (migration 0011) — 2026-09-22
- [x] Bütçe ekranı: kategori bazlı aylık zarflar; %80 uyarı / %100 aşım durumu `budgetState` içinde — 2026-09-22
- [x] Alışveriş: "işaretlileri harcamaya çevir" — tek işlemde (migration 0016) — 2026-09-22
- [ ] Planlar: seyahat detay (itinerary + rezervasyon + bavul listesi + bütçe vs gerçek)
- [x] Aile: belge süreleri (ekran + sabah özetinde hatırlatma) ve önemli günler yıllık tekrar — 2026-09-22
- [x] Bildirim merkezi (Bugün ekranında geçmiş) + sabah özeti RPC, kişiye özel (0013 + 0017) — 2026-09-22
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
