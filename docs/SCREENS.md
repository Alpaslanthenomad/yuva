# Ekran akışları (Faz 0)

```
[Bugün] ── hafta şeridi ──► [Takvim ?d=YYYY-MM-DD]
   │  ── "Para →" ─────────► [Para › Özet]
   │  ── görevler ─────────► [Aile ?tab=tasks]
   │  ── (+) FAB ──────────► Hızlı Ekle sheet: Harcama | Olay | Görev | Alışveriş
[Takvim] Hafta | Ay | Ajanda · üye filtresi · olay sheet (sil)
[Para] Özet | İşlemler | Bütçe | Düzenli | Hesaplar · ay gezinme · "+ Harcama ekle"
[Planlar] filtre (Seyahat/Davet/Proje/Hedef) · kart → detay sheet (öğeler / harcama ekle / görev ekle)
[Aile] Üyeler | Önemli günler | Belgeler | Görevler | Alışveriş
[Ayarlar] hane · katılım kodu · hesaplar · kurlar · kategoriler · veri (CSV, demo sıfırla)
[Giriş] e-posta magic link → hane kur / koda katıl (Supabase modu)
```

Tasarım kuralları için `CLAUDE.md §6`, dil kuralları için `CLAUDE.md §7`.

## Ekran görüntüleri

`docs/screens/` — her ekran iki dilde: `tr-*.png` ve `es-*.png`
(390×844, demo veriyle, Playwright ile otomatik çekilir).

## Dil geçişi

Dil seçici iki yerde: **Ayarlar › Uygulama dili** (blok) ve **Giriş** (kompakt).
Seçim `localStorage['yuva:locale']`'e yazılır, `<html lang>` güncellenir ve
sayfa yenilenmeden tüm arayüz değişir (React context ile). Hiç seçim yoksa
sıra: cihaz tercihi → `households.locale` → tarayıcı dili → `tr`.
