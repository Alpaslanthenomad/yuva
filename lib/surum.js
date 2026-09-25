// lib/surum.js — çalışan sürüm ile yayındaki sürümü karşılaştırır.
//
// NEDEN VAR: telefondaki uygulama günlerce eski sürümde kaldı. Üç gün önce
// yayınlanan ekranlar bile görünmüyordu ve bunu kimse fark edemedi, çünkü
// yayın tarafı sapasağlam görünüyordu.
//
// Service worker'ın kendi güncelleme mekanizması bu işi görmedi. Tarayıcı
// güncellemeye bakarken yalnızca sw.js dosyasını karşılaştırıyor; o dosya ise
// yayından yayına değişmiyor. Sonuç: hiçbir zaman "yeni sürüm var" demiyor.
// Tarayıcıda denendi ve doğrulandı.
//
// Bu yüzden karar sayfada veriliyor: uygulama kendi derleme kimliğini bilir,
// sunucudaki version.json'a bakar, farklıysa kendini yeniler.

export const YENILENDI_ANAHTAR = 'yuva:yenilendi';

/**
 * Yenilemeli mi?
 *
 * SONSUZ DÖNGÜ EN BÜYÜK RİSK. Sunucu bir sebeple hâlâ eski sayfayı
 * veriyorsa (CDN gecikmesi gibi) ve biz her farkta yenilersek, telefon
 * kendini durmadan yeniler — kullanıcı için güncellenmemekten çok daha kötü.
 * Bu yüzden her sürüm için YALNIZCA BİR KEZ yenileniyor; işaret oturumda
 * saklanıyor.
 *
 * @param {string} calisan sayfanın kendi derleme kimliği
 * @param {string} yayindaki version.json'daki kimlik
 * @param {string|null} sonYenilenen daha önce hangi sürüm için yenilendiği
 * @returns {boolean}
 */
export function yenilemeliMi(calisan, yayindaki, sonYenilenen) {
  if (!yayindaki || !calisan) return false;      // bilgi eksikse dokunma
  if (yayindaki === calisan) return false;       // zaten güncel
  if (sonYenilenen === yayindaki) return false;  // bu sürüm için bir kez denendi
  return true;
}
