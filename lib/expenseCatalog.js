// lib/expenseCatalog.js — sık yapılan harcamalar için hazır seçimler.
//
// AMAÇ: tutarı yaz, simgeye dokun, kaydet. Uber'den inerken telefonda
// "Uber" yazmak gereksiz; en sık girilen harcamalar zaten belli.
//
// NE YAPAR: seçim hem NEREYE alanını (merchant) hem de KATEGORİYİ doldurur.
// Kategori kimliği burada sabit tutulamaz — her hane kendi kategorilerini
// tohumluyor ve adlar dile göre değişiyor (Ulaşım / Transporte). Bu yüzden
// eşleştirme DESENLE yapılıyor.
//
// EŞLEŞME BULUNAMAZSA KATEGORİ BOŞ KALIR. Kasıtlı: hane kategorisini yeniden
// adlandırdıysa yanlış kategoriye yazmaktansa kullanıcı seçsin. Yanlış
// kategori sessizce bütçeyi bozar, boş kategori göze çarpar.
//
// KAPSAM: ulaşım ve dışarıda yeme-içme. İkisi de fişi cebe atılmayan, anında
// girilmesi gereken harcamalar. Market zaten alışveriş ekranından geliyor;
// kira/fatura düzenli gider olarak işleniyor (0011).

/**
 * Sıra ekrandaki sıradır: en sık dokunulan başta. Tek satır, yatay kaydırılır —
 * reyon sekmesi koymak, iki dokunuşu üçe çıkarırdı.
 *
 * `cat`: kategori adını bulmak için desen (önce alt, sonra üst kategoriler).
 * `parentCat`: hiçbiri tutmazsa düşülecek üst kategori deseni.
 */
export const EXPENSE_PRESETS = [
  // --- Market: EN BAŞTA ------------------------------------------------------
  // Kullanıcının uyarısıyla eklendi: hazır seçimlerde ulaşım ve restoran vardı
  // ama market yoktu — oysa bir hanenin en sık girdiği harcama market.
  // "Lider'e 40.000, Eltit'e 17.000 verdik" demek, üç dokunuşta kaydedilebilmeli.
  //
  // Bunlar MAĞAZA ADI, yani iki dilde de aynı yazılır. Şili zincirleri seçildi
  // (hane Santiago'da); mini market ve feria da eklendi çünkü hepsi zincir değil.
  //
  // Hepsi üst kategori "Market"e düşüyor, "Gıda" altına değil: bir market
  // alışverişi gıdayla birlikte temizlik ve kişisel bakım da içeriyor, tek bir
  // alt kategoriye yazmak bütçe kırılımını yanıltır.
  { key: 'lider',     group: 'market', emoji: '🛒', tr: 'Lider',        es: 'Líder',
    cat: /^market$|supermercado/i,                 parentCat: /market|supermercado/i },
  { key: 'jumbo',     group: 'market', emoji: '🛒', tr: 'Jumbo',        es: 'Jumbo',
    cat: /^market$|supermercado/i,                 parentCat: /market|supermercado/i },
  { key: 'santaisabel', group: 'market', emoji: '🛒', tr: 'Santa Isabel', es: 'Santa Isabel',
    cat: /^market$|supermercado/i,                 parentCat: /market|supermercado/i },
  { key: 'unimarc',   group: 'market', emoji: '🛒', tr: 'Unimarc',      es: 'Unimarc',
    cat: /^market$|supermercado/i,                 parentCat: /market|supermercado/i },
  { key: 'eltit',     group: 'market', emoji: '🛒', tr: 'Eltit',        es: 'Eltit',
    cat: /^market$|supermercado/i,                 parentCat: /market|supermercado/i },
  { key: 'minimarket', group: 'market', emoji: '🏪', tr: 'Mini market', es: 'Almacén',
    cat: /^market$|supermercado/i,                 parentCat: /market|supermercado/i },
  { key: 'feria',     group: 'market', emoji: '🥬', tr: 'Pazar / Feria', es: 'Feria',
    cat: /^market$|supermercado/i,                 parentCat: /market|supermercado/i },

  // --- En sık ---------------------------------------------------------------
  { key: 'uber',    group: 'transport', emoji: '🚕', tr: 'Uber',        es: 'Uber',
    cat: /taksi|taxi|uber|cabify|didi/i,           parentCat: /ulaşım|transporte/i },
  { key: 'taxi',    group: 'transport', emoji: '🚖', tr: 'Taksi',       es: 'Taxi',
    cat: /taksi|taxi|uber/i,                       parentCat: /ulaşım|transporte/i },
  { key: 'bus',     group: 'transport', emoji: '🚌', tr: 'Otobüs',      es: 'Bus',
    cat: /toplu taşıma|transporte público|micro/i, parentCat: /ulaşım|transporte/i },
  { key: 'metro',   group: 'transport', emoji: '🚇', tr: 'Metro',       es: 'Metro',
    cat: /toplu taşıma|transporte público|metro/i, parentCat: /ulaşım|transporte/i },
  { key: 'train',   group: 'transport', emoji: '🚆', tr: 'Tren',        es: 'Tren',
    cat: /toplu taşıma|transporte público|tren/i,  parentCat: /ulaşım|transporte/i },
  { key: 'plane',   group: 'transport', emoji: '✈️', tr: 'Uçak',        es: 'Avión',
    cat: /uçak|avión|vuelo/i,                      parentCat: /seyahat|viaje|ulaşım|transporte/i },
  { key: 'fuel',    group: 'transport', emoji: '⛽', tr: 'Benzin',      es: 'Bencina',
    cat: /yakıt|bencina|combustible/i,             parentCat: /ulaşım|transporte/i },
  { key: 'parking', group: 'transport', emoji: '🅿️', tr: 'Otopark',     es: 'Estacionamiento',
    cat: /otopark|estacionamiento/i,               parentCat: /ulaşım|transporte/i },
  { key: 'toll',    group: 'transport', emoji: '🛣️', tr: 'Geçiş / TAG', es: 'TAG / peaje',
    cat: /geçiş|tag|peaje|otoyol/i,                parentCat: /ulaşım|transporte/i },
  { key: 'carwash', group: 'transport', emoji: '🧼', tr: 'Oto yıkama',  es: 'Lavado de auto',
    cat: /bakım|mantención|lavado/i,               parentCat: /ulaşım|transporte/i },

  // --- Dışarıda yeme-içme ---------------------------------------------------
  { key: 'restaurant',  group: 'eatout', emoji: '🍽️', tr: 'Restoran',    es: 'Restaurante',
    cat: /restoran|restaurante/i,                  parentCat: /dışarıda|yeme|comer|restaurant/i },
  { key: 'cafe',        group: 'eatout', emoji: '☕', tr: 'Kahve',       es: 'Café',
    cat: /kahve|café/i,                            parentCat: /dışarıda|yeme|comer/i },
  { key: 'delivery',    group: 'eatout', emoji: '🛵', tr: 'Paket yemek', es: 'Delivery',
    cat: /paket|delivery|sipariş/i,                parentCat: /dışarıda|yeme|comer/i },
  { key: 'bakeryout',   group: 'eatout', emoji: '🥐', tr: 'Fırın',       es: 'Panadería',
    cat: /fırın|panadería/i,                       parentCat: /dışarıda|yeme|comer|market|supermercado/i },
  { key: 'icecreamout', group: 'eatout', emoji: '🍦', tr: 'Dondurma',    es: 'Helado',
    cat: /dondurma|helado/i,                       parentCat: /dışarıda|yeme|comer/i },

  // --- Diğer sık girilenler --------------------------------------------------
  // Padel, futbol, saha kirası: ayrı bir Spor kategorisi yok, "Eğlence &
  // Sosyal" altına düşüyor. Ayrı kategori açmak kullanıcının işi, tahminle
  // kategori yaratmak değil.
  { key: 'sport',    group: 'other', emoji: '🎾', tr: 'Spor / Padel', es: 'Deporte / Pádel',
    cat: /spor|deporte|padel|gym/i,                parentCat: /eğlence|sosyal|entreten/i },
  { key: 'pharmacy', group: 'other', emoji: '💊', tr: 'Eczane',       es: 'Farmacia',
    cat: /eczane|farmacia/i,                       parentCat: /sağlık|salud/i },
];

/** Ön tanımın o dildeki adı; bilinmeyen dilde Türkçe. */
export function presetName(p, locale) {
  if (!p) return '';
  return (String(locale || '').startsWith('es') ? p.es : p.tr) || p.tr;
}

/**
 * Ön tanım için kategori kimliği.
 * Sıra: alt kategori → üst kategori → parentCat → boş.
 * @param {Object} preset
 * @param {Object[]} categories hanenin kategorileri
 * @returns {string} kategori kimliği ya da ''
 */
export function presetCategoryId(preset, categories = []) {
  if (!preset) return '';
  const gider = (categories || []).filter((c) => c && c.kind === 'expense');
  const alt = gider.filter((c) => c.parent_id);
  const ust = gider.filter((c) => !c.parent_id);
  return alt.find((c) => preset.cat.test(c.name))?.id
      || ust.find((c) => preset.cat.test(c.name))?.id
      || (preset.parentCat ? ust.find((c) => preset.parentCat.test(c.name))?.id : '')
      || '';
}
