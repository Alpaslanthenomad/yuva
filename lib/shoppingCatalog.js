// lib/shoppingCatalog.js — hazır ürün kataloğu (yazmadan sepet kurmak için).
//
// NEDEN BURADA, i18n DOSYALARINDA DEĞİL: bunlar arayüz metni değil, VERİ.
// Ad iki dilde yan yana duruyor; böylece birini ekleyip diğerini unutmak
// mümkün değil (tests/shopping.test.js ayrıca doğruluyor). i18n dosyalarına
// dağıtılsaydı 85 ürün × 2 dil iki ayrı yerde tutulacaktı.
//
// NEDEN EMOJİ: uygulama statik dışa aktarılıyor ve dış sunucudan dosya
// çekmiyor. 85 küçük görsel boyut, lisans ve çevrimdışı derdi demekti.
// Emoji sıfır bayt, telefonda net, kategorilerde zaten kullanılan dil.
//
// SEÇİM ÖLÇÜSÜ: Santiago'da bir haftalık market. Marka yok, ölçü yok —
// "Domates" var, "2 kg domates" yok. Miktar gerekirse kalem eklendikten
// sonra listede yazılır. Katalogda olmayan bir şey için yazarak ekleme
// yolu yerinde duruyor; bu ekran onun yerine değil, önüne geçiyor.

/** Reyon sırası: markette yürüme sırasına yakın. */
export const SHOPPING_GROUPS = [
  { key: 'produce',  emoji: '🥬', tr: 'Meyve & sebze', es: 'Frutas y verduras' },
  { key: 'bakery',   emoji: '🍞', tr: 'Fırın',          es: 'Panadería' },
  { key: 'dairy',    emoji: '🥛', tr: 'Süt ürünleri',   es: 'Lácteos' },
  { key: 'meat',     emoji: '🍗', tr: 'Et & balık',     es: 'Carnes y pescados' },
  { key: 'pantry',   emoji: '🫙', tr: 'Kiler',          es: 'Despensa' },
  { key: 'drinks',   emoji: '🥤', tr: 'İçecek',         es: 'Bebidas' },
  { key: 'cleaning', emoji: '🧽', tr: 'Temizlik',       es: 'Aseo' },
  { key: 'home',     emoji: '🏠', tr: 'Ev',             es: 'Casa' },
];

export const SHOPPING_CATALOG = [
  // --- Meyve & sebze -------------------------------------------------------
  { key: 'tomato',      group: 'produce',  emoji: '🍅', tr: 'Domates',         es: 'Tomate' },
  { key: 'cucumber',    group: 'produce',  emoji: '🥒', tr: 'Salatalık',       es: 'Pepino' },
  { key: 'onion',       group: 'produce',  emoji: '🧅', tr: 'Soğan',           es: 'Cebolla' },
  { key: 'garlic',      group: 'produce',  emoji: '🧄', tr: 'Sarımsak',        es: 'Ajo' },
  { key: 'potato',      group: 'produce',  emoji: '🥔', tr: 'Patates',         es: 'Papas' },
  { key: 'carrot',      group: 'produce',  emoji: '🥕', tr: 'Havuç',           es: 'Zanahoria' },
  { key: 'pepper',      group: 'produce',  emoji: '🫑', tr: 'Biber',           es: 'Pimentón' },
  { key: 'lettuce',     group: 'produce',  emoji: '🥬', tr: 'Marul',           es: 'Lechuga' },
  { key: 'avocado',     group: 'produce',  emoji: '🥑', tr: 'Avokado',         es: 'Palta' },
  { key: 'broccoli',    group: 'produce',  emoji: '🥦', tr: 'Brokoli',         es: 'Brócoli' },
  { key: 'corn',        group: 'produce',  emoji: '🌽', tr: 'Mısır',           es: 'Choclo' },
  { key: 'eggplant',    group: 'produce',  emoji: '🍆', tr: 'Patlıcan',        es: 'Berenjena' },
  { key: 'zucchini',    group: 'produce',  emoji: '🥒', tr: 'Kabak',           es: 'Zapallo italiano' },
  { key: 'pumpkin',     group: 'produce',  emoji: '🎃', tr: 'Balkabağı',       es: 'Zapallo' },
  { key: 'mushroom',    group: 'produce',  emoji: '🍄', tr: 'Mantar',          es: 'Champiñones' },
  { key: 'lemon',       group: 'produce',  emoji: '🍋', tr: 'Limon',           es: 'Limón' },
  { key: 'apple',       group: 'produce',  emoji: '🍎', tr: 'Elma',            es: 'Manzana' },
  { key: 'banana',      group: 'produce',  emoji: '🍌', tr: 'Muz',             es: 'Plátano' },
  { key: 'orange',      group: 'produce',  emoji: '🍊', tr: 'Portakal',        es: 'Naranja' },
  { key: 'grapes',      group: 'produce',  emoji: '🍇', tr: 'Üzüm',            es: 'Uva' },
  { key: 'strawberry',  group: 'produce',  emoji: '🍓', tr: 'Çilek',           es: 'Frutilla' },
  { key: 'watermelon',  group: 'produce',  emoji: '🍉', tr: 'Karpuz',          es: 'Sandía' },
  { key: 'peach',       group: 'produce',  emoji: '🍑', tr: 'Şeftali',         es: 'Durazno' },
  { key: 'pear',        group: 'produce',  emoji: '🍐', tr: 'Armut',           es: 'Pera' },
  { key: 'herbs',       group: 'produce',  emoji: '🌿', tr: 'Yeşillik',        es: 'Cilantro / perejil' },

  // --- Fırın ---------------------------------------------------------------
  { key: 'bread',       group: 'bakery',   emoji: '🍞', tr: 'Ekmek',           es: 'Pan' },
  { key: 'baguette',    group: 'bakery',   emoji: '🥖', tr: 'Baget',           es: 'Marraqueta' },
  { key: 'tortilla',    group: 'bakery',   emoji: '🫓', tr: 'Lavaş',           es: 'Tortilla' },
  { key: 'toastbread',  group: 'bakery',   emoji: '🥪', tr: 'Tost ekmeği',     es: 'Pan de molde' },
  { key: 'cake',        group: 'bakery',   emoji: '🍰', tr: 'Kek',             es: 'Queque' },

  // --- Süt ürünleri --------------------------------------------------------
  { key: 'milk',        group: 'dairy',    emoji: '🥛', tr: 'Süt',             es: 'Leche' },
  { key: 'eggs',        group: 'dairy',    emoji: '🥚', tr: 'Yumurta',         es: 'Huevos' },
  { key: 'cheese',      group: 'dairy',    emoji: '🧀', tr: 'Peynir',          es: 'Queso' },
  { key: 'yogurt',      group: 'dairy',    emoji: '🥣', tr: 'Yoğurt',          es: 'Yogur' },
  { key: 'butter',      group: 'dairy',    emoji: '🧈', tr: 'Tereyağı',        es: 'Mantequilla' },
  { key: 'cream',       group: 'dairy',    emoji: '🍶', tr: 'Krema',           es: 'Crema' },

  // --- Et & balık ----------------------------------------------------------
  { key: 'chicken',     group: 'meat',     emoji: '🍗', tr: 'Tavuk',           es: 'Pollo' },
  { key: 'mince',       group: 'meat',     emoji: '🥩', tr: 'Kıyma',           es: 'Carne molida' },
  { key: 'beef',        group: 'meat',     emoji: '🐄', tr: 'Dana eti',        es: 'Carne de vacuno' },
  { key: 'fish',        group: 'meat',     emoji: '🐟', tr: 'Balık',           es: 'Pescado' },
  { key: 'tuna',        group: 'meat',     emoji: '🥫', tr: 'Ton balığı',      es: 'Atún' },
  { key: 'sausage',     group: 'meat',     emoji: '🌭', tr: 'Sosis',           es: 'Salchichas' },
  { key: 'ham',         group: 'meat',     emoji: '🥓', tr: 'Jambon',          es: 'Jamón' },

  // --- Kiler ---------------------------------------------------------------
  { key: 'rice',        group: 'pantry',   emoji: '🍚', tr: 'Pirinç',          es: 'Arroz' },
  { key: 'pasta',       group: 'pantry',   emoji: '🍝', tr: 'Makarna',         es: 'Fideos' },
  { key: 'flour',       group: 'pantry',   emoji: '🌾', tr: 'Un',              es: 'Harina' },
  { key: 'sugar',       group: 'pantry',   emoji: '🍬', tr: 'Şeker',           es: 'Azúcar' },
  { key: 'salt',        group: 'pantry',   emoji: '🧂', tr: 'Tuz',             es: 'Sal' },
  { key: 'oil',         group: 'pantry',   emoji: '🫒', tr: 'Sıvı yağ',        es: 'Aceite' },
  { key: 'vinegar',     group: 'pantry',   emoji: '🍾', tr: 'Sirke',           es: 'Vinagre' },
  { key: 'beans',       group: 'pantry',   emoji: '🫘', tr: 'Kuru fasulye',    es: 'Porotos' },
  { key: 'lentils',     group: 'pantry',   emoji: '🥣', tr: 'Mercimek',        es: 'Lentejas' },
  { key: 'chickpeas',   group: 'pantry',   emoji: '🫛', tr: 'Nohut',           es: 'Garbanzos' },
  { key: 'tomatosauce', group: 'pantry',   emoji: '🥫', tr: 'Salça',           es: 'Salsa de tomate' },
  { key: 'olives',      group: 'pantry',   emoji: '🫒', tr: 'Zeytin',          es: 'Aceitunas' },
  { key: 'honey',       group: 'pantry',   emoji: '🍯', tr: 'Bal',             es: 'Miel' },
  { key: 'jam',         group: 'pantry',   emoji: '🍓', tr: 'Reçel',           es: 'Mermelada' },
  { key: 'nuts',        group: 'pantry',   emoji: '🥜', tr: 'Kuruyemiş',       es: 'Frutos secos' },
  { key: 'cereal',      group: 'pantry',   emoji: '🥣', tr: 'Mısır gevreği',   es: 'Cereal' },
  { key: 'cookies',     group: 'pantry',   emoji: '🍪', tr: 'Bisküvi',         es: 'Galletas' },
  { key: 'chocolate',   group: 'pantry',   emoji: '🍫', tr: 'Çikolata',        es: 'Chocolate' },
  { key: 'chips',       group: 'pantry',   emoji: '🍟', tr: 'Cips',            es: 'Papas fritas' },
  { key: 'spices',      group: 'pantry',   emoji: '🌶️', tr: 'Baharat',         es: 'Especias' },

  // --- İçecek --------------------------------------------------------------
  { key: 'water',       group: 'drinks',   emoji: '💧', tr: 'Su',              es: 'Agua' },
  { key: 'coffee',      group: 'drinks',   emoji: '☕', tr: 'Kahve',           es: 'Café' },
  { key: 'tea',         group: 'drinks',   emoji: '🍵', tr: 'Çay',             es: 'Té' },
  { key: 'juice',       group: 'drinks',   emoji: '🧃', tr: 'Meyve suyu',      es: 'Jugo' },
  { key: 'soda',        group: 'drinks',   emoji: '🥤', tr: 'Gazlı içecek',    es: 'Bebida' },
  { key: 'wine',        group: 'drinks',   emoji: '🍷', tr: 'Şarap',           es: 'Vino' },
  { key: 'beer',        group: 'drinks',   emoji: '🍺', tr: 'Bira',            es: 'Cerveza' },

  // --- Temizlik ------------------------------------------------------------
  { key: 'detergent',   group: 'cleaning', emoji: '🧴', tr: 'Çamaşır deterjanı', es: 'Detergente' },
  { key: 'dishsoap',    group: 'cleaning', emoji: '🧽', tr: 'Bulaşık deterjanı', es: 'Lavaloza' },
  { key: 'bleach',      group: 'cleaning', emoji: '🧪', tr: 'Çamaşır suyu',    es: 'Cloro' },
  { key: 'toiletpaper', group: 'cleaning', emoji: '🧻', tr: 'Tuvalet kağıdı',  es: 'Papel higiénico' },
  { key: 'papertowel',  group: 'cleaning', emoji: '🧼', tr: 'Kağıt havlu',     es: 'Toalla de papel' },
  { key: 'soap',        group: 'cleaning', emoji: '🧼', tr: 'Sabun',           es: 'Jabón' },
  { key: 'shampoo',     group: 'cleaning', emoji: '🧴', tr: 'Şampuan',         es: 'Champú' },
  { key: 'toothpaste',  group: 'cleaning', emoji: '🪥', tr: 'Diş macunu',      es: 'Pasta de dientes' },
  { key: 'sponge',      group: 'cleaning', emoji: '🧽', tr: 'Sünger',          es: 'Esponja' },
  { key: 'trashbags',   group: 'cleaning', emoji: '🗑️', tr: 'Çöp poşeti',      es: 'Bolsas de basura' },

  // --- Ev ------------------------------------------------------------------
  { key: 'batteries',   group: 'home',     emoji: '🔋', tr: 'Pil',             es: 'Pilas' },
  { key: 'bulb',        group: 'home',     emoji: '💡', tr: 'Ampul',           es: 'Ampolleta' },
  { key: 'foil',        group: 'home',     emoji: '📦', tr: 'Streç / folyo',   es: 'Alusa / papel aluminio' },
  { key: 'petfood',     group: 'home',     emoji: '🐾', tr: 'Mama',            es: 'Comida de mascota' },
  { key: 'flowers',     group: 'home',     emoji: '💐', tr: 'Çiçek',           es: 'Flores' },
];

/** Katalog kaydının o dildeki adı. Bilinmeyen dilde Türkçeye düşer. */
export function catalogName(item, locale) {
  if (!item) return '';
  return (String(locale || '').startsWith('es') ? item.es : item.tr) || item.tr;
}

/**
 * Ad karşılaştırması için sadeleştirme. Listede zaten olan ürünü işaretli
 * göstermek için kullanılır.
 *
 * Üç şey yok sayılır:
 *  - büyük/küçük harf (Türkçeye duyarlı: 'İ'.toLowerCase() varsayılan yerelde
 *    'i̇' üretiyor ve eşleşme kaçıyordu),
 *  - baştaki/sondaki boşluk,
 *  - PARANTEZ İÇİ. Miktar bu uygulamada parantezle yazılıyor ("Süt (2 L)").
 *    Yok sayılmasaydı katalogdaki "Süt" eşleşmez, ızgara işaretsiz görünür ve
 *    dokununca listeye ikinci bir "Süt" eklenirdi.
 */
export function normalizeName(s) {
  return String(s || '').replace(/\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim().toLocaleLowerCase('tr');
}

/** Ada göre katalog kaydını bul (iki dilde de arar). Yoksa null. */
export function findCatalogItem(name) {
  const n = normalizeName(name);
  return SHOPPING_CATALOG.find((x) => normalizeName(x.tr) === n || normalizeName(x.es) === n) || null;
}
