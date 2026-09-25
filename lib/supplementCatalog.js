// lib/supplementCatalog.js — günlük takviye kataloğu (yazmadan seçmek için).
//
// NEDEN AYRI DOSYA: alışveriş kataloğuyla (shoppingCatalog.js) aynı mantık ama
// farklı iş. Orada "eve ne alacağız", burada "bugün aldım mı". Aynı listeye
// tıkıştırmak, market ızgarasını her gün içilen şeylerle şişirirdi.
//
// TIBBİ İÇERİK YOK (CLAUDE.md sınırı). Katalogda reçeteli ilaç, doz önerisi
// veya "ne işe yarar" açıklaması YOK; yalnızca ad, emoji ve yaygın bir ölçü
// birimi var. Ölçüler öneri değil, yazı kutusunu boş bırakmamak için hazır
// metin; kullanıcı istediği gibi değiştiriyor.
//
// DOZ ALANI SERBEST METİN: "5 g", "2 kapsül", "1 ölçek". Sayıya çevirip
// birim listesi tutmak, kazancı olmayan bir karmaşıklıktı.

/** Bölümler: sabah rafından spor çantasına doğru. */
export const SUPPLEMENT_GROUPS = [
  { key: 'daily',   emoji: '☀️', tr: 'Günlük temel',  es: 'Diario básico' },
  { key: 'mineral', emoji: '🧂', tr: 'Mineraller',    es: 'Minerales' },
  { key: 'sport',   emoji: '🏋️', tr: 'Spor',          es: 'Deporte' },
  { key: 'protein', emoji: '🥤', tr: 'Protein',       es: 'Proteína' },
  { key: 'herbal',  emoji: '🌿', tr: 'Bitkisel',      es: 'Herbal' },
  { key: 'gut',     emoji: '🫧', tr: 'Sindirim',      es: 'Digestión' },
  { key: 'sleep',   emoji: '🌙', tr: 'Uyku & sakinlik', es: 'Sueño y calma' },
];

export const SUPPLEMENT_CATALOG = [
  // --- Günlük temel --------------------------------------------------------
  { key: 'multivitamin', group: 'daily',   emoji: '💊', tr: 'Multivitamin',   es: 'Multivitamínico', dose: '1' },
  { key: 'vitamin_d',    group: 'daily',   emoji: '☀️', tr: 'D vitamini',     es: 'Vitamina D',      dose: '1' },
  { key: 'vitamin_c',    group: 'daily',   emoji: '🍊', tr: 'C vitamini',     es: 'Vitamina C',      dose: '1' },
  { key: 'vitamin_b12',  group: 'daily',   emoji: '🅱️', tr: 'B12',            es: 'B12',             dose: '1' },
  { key: 'b_complex',    group: 'daily',   emoji: '🧬', tr: 'B kompleks',     es: 'Complejo B',      dose: '1' },
  { key: 'omega3',       group: 'daily',   emoji: '🐟', tr: 'Omega-3',        es: 'Omega-3',         dose: '2' },
  { key: 'vitamin_e',    group: 'daily',   emoji: '🫒', tr: 'E vitamini',     es: 'Vitamina E',      dose: '1' },
  { key: 'vitamin_k2',   group: 'daily',   emoji: '🥬', tr: 'K2 vitamini',    es: 'Vitamina K2',     dose: '1' },

  // --- Mineraller ----------------------------------------------------------
  { key: 'magnesium',    group: 'mineral', emoji: '🧂', tr: 'Magnezyum',      es: 'Magnesio',        dose: '1' },
  { key: 'zinc',         group: 'mineral', emoji: '⚪', tr: 'Çinko',          es: 'Zinc',            dose: '1' },
  { key: 'iron',         group: 'mineral', emoji: '🔩', tr: 'Demir',          es: 'Hierro',          dose: '1' },
  { key: 'calcium',      group: 'mineral', emoji: '🦴', tr: 'Kalsiyum',       es: 'Calcio',          dose: '1' },
  { key: 'selenium',     group: 'mineral', emoji: '🌰', tr: 'Selenyum',       es: 'Selenio',         dose: '1' },
  { key: 'iodine',       group: 'mineral', emoji: '🧪', tr: 'İyot',           es: 'Yodo',            dose: '1' },
  { key: 'potassium',    group: 'mineral', emoji: '🍌', tr: 'Potasyum',       es: 'Potasio',         dose: '1' },
  { key: 'electrolyte',  group: 'mineral', emoji: '⚡', tr: 'Elektrolit',     es: 'Electrolitos',    dose: '1' },

  // --- Spor ----------------------------------------------------------------
  { key: 'creatine',     group: 'sport',   emoji: '💪', tr: 'Kreatin',        es: 'Creatina',        dose: '5 g' },
  { key: 'glutamine',    group: 'sport',   emoji: '🧴', tr: 'Glutamin',       es: 'Glutamina',       dose: '5 g' },
  { key: 'bcaa',         group: 'sport',   emoji: '🔗', tr: 'BCAA',           es: 'BCAA',            dose: '1' },
  { key: 'eaa',          group: 'sport',   emoji: '🧩', tr: 'EAA',            es: 'EAA',             dose: '1' },
  { key: 'beta_alanine', group: 'sport',   emoji: '🔥', tr: 'Beta-alanin',    es: 'Beta-alanina',    dose: '3 g' },
  { key: 'carnitine',    group: 'sport',   emoji: '🏃', tr: 'L-karnitin',     es: 'L-carnitina',     dose: '1' },
  { key: 'citrulline',   group: 'sport',   emoji: '🍉', tr: 'Sitrülin',       es: 'Citrulina',       dose: '6 g' },
  { key: 'preworkout',   group: 'sport',   emoji: '⚡', tr: 'Antrenman öncesi', es: 'Pre-entreno',   dose: '1' },
  { key: 'hmb',          group: 'sport',   emoji: '🛡️', tr: 'HMB',            es: 'HMB',             dose: '1' },

  // --- Protein -------------------------------------------------------------
  { key: 'whey',         group: 'protein', emoji: '🥤', tr: 'Whey protein',   es: 'Proteína whey',   dose: '1' },
  { key: 'casein',       group: 'protein', emoji: '🌛', tr: 'Kazein',         es: 'Caseína',         dose: '1' },
  { key: 'plant_protein',group: 'protein', emoji: '🌱', tr: 'Bitkisel protein', es: 'Proteína vegetal', dose: '1' },
  { key: 'collagen',     group: 'protein', emoji: '✨', tr: 'Kolajen',        es: 'Colágeno',        dose: '1' },
  { key: 'protein_bar',  group: 'protein', emoji: '🍫', tr: 'Protein bar',    es: 'Barra proteica',  dose: '1' },

  // --- Bitkisel ------------------------------------------------------------
  { key: 'ashwagandha',  group: 'herbal',  emoji: '🌿', tr: 'Ashwagandha',    es: 'Ashwagandha',     dose: '1' },
  { key: 'curcumin',     group: 'herbal',  emoji: '🟡', tr: 'Zerdeçal',       es: 'Cúrcuma',         dose: '1' },
  { key: 'ginger',       group: 'herbal',  emoji: '🫚', tr: 'Zencefil',       es: 'Jengibre',        dose: '1' },
  { key: 'green_tea',    group: 'herbal',  emoji: '🍵', tr: 'Yeşil çay',      es: 'Té verde',        dose: '1' },
  { key: 'ginseng',      group: 'herbal',  emoji: '🌱', tr: 'Ginseng',        es: 'Ginseng',         dose: '1' },
  { key: 'maca',         group: 'herbal',  emoji: '🥔', tr: 'Maca',           es: 'Maca',            dose: '1' },
  { key: 'garlic_ext',   group: 'herbal',  emoji: '🧄', tr: 'Sarımsak özütü', es: 'Extracto de ajo', dose: '1' },
  { key: 'echinacea',    group: 'herbal',  emoji: '🌸', tr: 'Ekinezya',       es: 'Equinácea',       dose: '1' },

  // --- Sindirim ------------------------------------------------------------
  { key: 'probiotic',    group: 'gut',     emoji: '🫧', tr: 'Probiyotik',     es: 'Probiótico',      dose: '1' },
  { key: 'prebiotic',    group: 'gut',     emoji: '🌾', tr: 'Prebiyotik',     es: 'Prebiótico',      dose: '1' },
  { key: 'fiber',        group: 'gut',     emoji: '🥣', tr: 'Lif',            es: 'Fibra',           dose: '1' },
  { key: 'enzyme',       group: 'gut',     emoji: '⚗️', tr: 'Sindirim enzimi', es: 'Enzimas digestivas', dose: '1' },
  { key: 'apple_vinegar',group: 'gut',     emoji: '🍏', tr: 'Elma sirkesi',   es: 'Vinagre de manzana', dose: '1' },

  // --- Uyku & sakinlik -----------------------------------------------------
  { key: 'melatonin',    group: 'sleep',   emoji: '🌙', tr: 'Melatonin',      es: 'Melatonina',      dose: '1' },
  { key: 'mag_glycinate',group: 'sleep',   emoji: '😴', tr: 'Magnezyum glisinat', es: 'Magnesio glicinato', dose: '1' },
  { key: 'l_theanine',   group: 'sleep',   emoji: '🍃', tr: 'L-teanin',       es: 'L-teanina',       dose: '1' },
  { key: 'chamomile',    group: 'sleep',   emoji: '🌼', tr: 'Papatya',        es: 'Manzanilla',      dose: '1' },
];

/** Katalog kaydının o dildeki adı. */
export function supplementName(item, locale) {
  if (!item) return '';
  return String(locale || '').startsWith('es') ? item.es : item.tr;
}

/** Anahtardan katalog kaydı. Serbest yazılan takviyede anahtar yok, null döner. */
export function findSupplement(key) {
  return SUPPLEMENT_CATALOG.find((x) => x.key === key) || null;
}
