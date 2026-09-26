// lib/planCatalog.js — plan kategorileri (ikon, varsayılanlar, hazır liste).
//
// NEDEN: dört soyut tür (seyahat/davet/proje/hedef) gerçek hayata oturmuyordu.
// "Arkadaşlar bizi evine davet etti" bunların hiçbiri değil; üstelik "davet"
// türü misafir listesi ve bütçe istiyordu. Kullanıcı bir KATEGORİ seçiyor,
// davranışı (kind) katalog belirliyor.
//
// VERİ, ARAYÜZ METNİ DEĞİL: adlar iki dilde yan yana (shoppingCatalog.js ile
// aynı gerekçe). tests/planlar.test.js eksik dili yakalıyor.
//
// money: plan varsayılan olarak para içeriyor mu. Kullanıcı formda
// değiştirebiliyor; bu yalnızca başlangıç değeri.
// guests: misafir listesi anlamlı mı (ağırlarken evet, misafirliğe giderken hayır).
// multiDay: bitiş tarihi sorulsun mu.
// list: plan açılınca hazır gelen kontrol listesi; istenmezse formda kapatılıyor.

export const PLAN_GROUPS = [
  { key: 'social',  tr: 'Sosyal',      es: 'Social' },
  { key: 'outings', tr: 'Gezi & etkinlik', es: 'Salidas' },
  { key: 'home',    tr: 'Ev & iş',     es: 'Casa y trámites' },
];

export const PLAN_CATEGORIES = [
  { key: 'visit', group: 'social', kind: 'gathering', emoji: '🏡', money: false, guests: false, multiDay: false,
    tr: 'Misafirliğe gidiyoruz', es: 'Vamos de visita',
    hintTr: "Ayşe'lerde akşam yemeği", hintEs: 'Cena donde los Pérez',
    list: [['Hediye ya da tatlı al', 'Llevar un regalo o postre'], ['Adresi ve saati teyit et', 'Confirmar dirección y hora'], ['Çocukları hazırla', 'Preparar a los niños']] },
  { key: 'host', group: 'social', kind: 'gathering', emoji: '🍽️', money: true, guests: true, multiDay: false,
    tr: 'Misafir ağırlıyoruz', es: 'Recibimos visitas',
    hintTr: 'Cumartesi akşam yemeği', hintEs: 'Cena del sábado',
    list: [['Menüyü belirle', 'Definir el menú'], ['Alışverişi yap', 'Hacer las compras'], ['Evi hazırla', 'Preparar la casa'], ['Davetlilere haber ver', 'Avisar a los invitados']] },
  { key: 'celebration', group: 'social', kind: 'gathering', emoji: '🎂', money: true, guests: true, multiDay: false,
    tr: 'Doğum günü & kutlama', es: 'Cumpleaños y celebración',
    hintTr: "Deniz'in doğum günü", hintEs: 'Cumpleaños de Deniz',
    list: [['Pasta', 'Torta'], ['Hediye', 'Regalo'], ['Süsleme', 'Decoración'], ['Davetiyeler', 'Invitaciones']] },
  { key: 'eatout', group: 'social', kind: 'gathering', emoji: '🍴', money: true, guests: false, multiDay: false,
    tr: 'Dışarıda yemek', es: 'Comer fuera',
    hintTr: 'Pazar kahvaltısı', hintEs: 'Desayuno del domingo',
    list: [['Rezervasyon yap', 'Hacer la reserva']] },
  { key: 'kids', group: 'social', kind: 'gathering', emoji: '🧸', money: false, guests: false, multiDay: false,
    tr: 'Çocuk etkinliği', es: 'Actividad de niños',
    hintTr: 'Okul gösterisi', hintEs: 'Presentación del colegio',
    list: [['Kıyafeti hazırla', 'Preparar la ropa'], ['Ulaşımı ayarla', 'Coordinar el traslado']] },

  { key: 'outing', group: 'outings', kind: 'trip', emoji: '🌳', money: false, guests: false, multiDay: false,
    tr: 'Günübirlik gezi', es: 'Paseo del día',
    hintTr: 'Cajón del Maipo', hintEs: 'Cajón del Maipo',
    list: [['Su ve atıştırmalık', 'Agua y colaciones'], ['Güneş kremi', 'Bloqueador'], ['Yol ve benzin', 'Ruta y bencina']] },
  { key: 'trip', group: 'outings', kind: 'trip', emoji: '✈️', money: true, guests: false, multiDay: true,
    tr: 'Seyahat', es: 'Viaje',
    hintTr: 'Yaz tatili', hintEs: 'Vacaciones de verano',
    list: [['Biletler', 'Pasajes'], ['Konaklama', 'Alojamiento'], ['Pasaport ve kimlik kontrolü', 'Revisar pasaportes y carnets'], ['Valizler', 'Maletas']] },
  { key: 'culture', group: 'outings', kind: 'gathering', emoji: '🎭', money: true, guests: false, multiDay: false,
    tr: 'Konser, sinema, müze', es: 'Concierto, cine, museo',
    hintTr: 'Çocuklarla müze', hintEs: 'Museo con los niños',
    list: [['Biletleri al', 'Comprar entradas']] },
  { key: 'sport', group: 'outings', kind: 'gathering', emoji: '⚽', money: false, guests: false, multiDay: false,
    tr: 'Spor & aktivite', es: 'Deporte y actividad',
    hintTr: 'Padel maçı', hintEs: 'Partido de pádel',
    list: [['Ekipmanı hazırla', 'Preparar el equipo']] },

  { key: 'home', group: 'home', kind: 'project', emoji: '🔨', money: true, guests: false, multiDay: true,
    tr: 'Ev işi & tadilat', es: 'Arreglos de la casa',
    hintTr: 'Mutfak dolapları', hintEs: 'Muebles de cocina',
    list: [['Malzeme listesi', 'Lista de materiales'], ['Usta ve fiyat', 'Maestro y presupuesto']] },
  { key: 'purchase', group: 'home', kind: 'project', emoji: '🛍️', money: true, guests: false, multiDay: false,
    tr: 'Büyük alışveriş', es: 'Compra grande',
    hintTr: 'Yeni buzdolabı', hintEs: 'Refrigerador nuevo',
    list: [['Seçenekleri karşılaştır', 'Comparar opciones'], ['Bütçeyi belirle', 'Definir el presupuesto']] },
  { key: 'errand', group: 'home', kind: 'project', emoji: '📋', money: false, guests: false, multiDay: false,
    tr: 'Resmi iş & randevu', es: 'Trámite y cita',
    hintTr: 'Kimlik yenileme', hintEs: 'Renovar el carnet',
    list: [['Belgeleri topla', 'Reunir documentos'], ['Randevu al', 'Pedir hora']] },
  { key: 'goal', group: 'home', kind: 'goal', emoji: '🎯', money: true, guests: false, multiDay: true,
    tr: 'Birikim hedefi', es: 'Meta de ahorro',
    hintTr: 'Araba peşinatı', hintEs: 'Pie del auto',
    list: [] },
  { key: 'other', group: 'home', kind: 'project', emoji: '✨', money: false, guests: false, multiDay: false,
    tr: 'Diğer', es: 'Otro', hintTr: '', hintEs: '', list: [] },
];

/**
 * Plan masrafının hangi harcama kategorisine yazılacağı (0028). Hanenin
 * kategori adlarıyla eşleşiyor (expenseCatalog.presetCategoryId ile aynı
 * yöntem); bulunamazsa boş kalır ve harcama kategorisiz yazılır.
 */
export const PLAN_COST_CATEGORY = {
  visit:       { cat: /davet|misafir|invitad|visita/i,          parentCat: /eğlence|sosyal|entreten|social/i },
  host:        { cat: /davet|misafir|invitad/i,                  parentCat: /eğlence|sosyal|entreten|social/i },
  celebration: { cat: /hediye|regalo|davet/i,                    parentCat: /eğlence|sosyal|entreten|social/i },
  eatout:      { cat: /restoran|restaurante/i,                   parentCat: /yeme|comer|restaurant/i },
  kids:        { cat: /kurs|aktivite|actividad/i,                parentCat: /çocuk|niños|hijos/i },
  outing:      { cat: /seyahatte|gastos de viaje/i,              parentCat: /seyahat|viaje/i },
  trip:        { cat: /seyahatte|gastos de viaje/i,              parentCat: /seyahat|viaje/i },
  culture:     { cat: /etkinlik|sinema|cine|evento/i,            parentCat: /eğlence|sosyal|entreten/i },
  sport:       { cat: /spor|deporte|padel|gym/i,                 parentCat: /eğlence|sosyal|entreten/i },
  home:        { cat: /bakım|tamir|mantenci|reparaci/i,          parentCat: /^ev$|hogar|casa/i },
  purchase:    { cat: /^ev$|hogar|casa/i,                        parentCat: /^ev$|hogar|casa/i },
  errand:      { cat: /vergi|resmi|trámite|impuesto/i,           parentCat: /vergi|resmi|trámite/i },
  other:       { cat: /^diğer$|^otro/i,                          parentCat: /^diğer$|^otro/i },
};

const es = (locale) => String(locale || '').startsWith('es');

/** Kategori kaydı. Eski planlarda kategori yoksa türünden tahmin edilir. */
export function planCategory(plan) {
  const key = typeof plan === 'string' ? plan : plan?.category;
  const byKey = PLAN_CATEGORIES.find((c) => c.key === key);
  if (byKey) return byKey;
  const kind = typeof plan === 'object' ? plan?.kind : null;
  const fallback = { trip: 'trip', gathering: 'host', project: 'home', goal: 'goal' }[kind] || 'other';
  return PLAN_CATEGORIES.find((c) => c.key === fallback);
}

export const categoryName = (c, locale) => (c ? (es(locale) ? c.es : c.tr) : '');
export const categoryHint = (c, locale) => (c ? (es(locale) ? c.hintEs : c.hintTr) : '');
export const groupName = (g, locale) => (es(locale) ? g.es : g.tr);
/** Hazır kontrol listesi, seçili dilde. */
export const categoryList = (c, locale) => (c?.list || []).map(([tr, sp]) => (es(locale) ? sp : tr));

/**
 * Planların ekrandaki bölümü. Sıra: yaklaşan (bugün sürenler dahil),
 * tarihsiz fikirler, birikim hedefleri, geçmiş. İptal edilen geçmişe gider.
 */
export function planSection(plan, todayISO) {
  if (plan.kind === 'goal') return 'goals';
  if (plan.status === 'cancelled' || plan.status === 'done') return 'past';
  if (!plan.starts_on) return 'ideas';
  const son = plan.ends_on || plan.starts_on;
  if (son < todayISO) return 'past';
  return 'upcoming';
}

// ---- Doğum günü / yıldönümü hediyesi (0032) -------------------------------
/** Hediye hatırlatması yapılan önemli gün türleri. */
export const HEDIYE_TURLERI = ['birthday', 'anniversary'];
export const hediyeUygun = (o) => HEDIYE_TURLERI.includes(o?.kind);
/** O günün bu yılki tekrarı için hediye planı açan adres. */
export const hediyeLinki = (o) => `/planlar/?hediye=${o.id}&d=${o.date}`;
/** Bu önemli günün bu tekrarına bağlı plan var mı? */
export const hediyePlani = (plans, o) =>
  (plans || []).find((p) => p.occasion_id === o.id && p.starts_on === o.date) || null;
/** Hediye planının hazır kontrol listesi. */
export const HEDIYE_LISTESI = [['Hediyeyi seç', 'Elegir el regalo'], ['Satın al', 'Comprarlo'], ['Paketle / kartı yaz', 'Envolver / escribir la tarjeta']];
