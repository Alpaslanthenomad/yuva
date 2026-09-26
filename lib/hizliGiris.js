// lib/hizliGiris.js — tek satırda harcama ("jumbo 45990") ve mağaza adı eşleştirme.
//
// İSTEK (öneri 11 + 1): "jumbo 45990 yazıp Enter'a basınca tutar, yer ve
// öğrenilmiş kategori birlikte dolsun" ve "bir yeri bir kez kategorilediğinde
// uygulama bunu hatırlasın".
//
// Tutar yazımları (Şili alışkanlıkları dahil):
//   45990 · 45.990 · 45 990 · 1.250.000 · 12k · 12,5k · 12 lucas · 8.5 · 8,50
// "kişisel" / "personal" kelimesi harcamayı kişisel yapar.

/** Karşılaştırma anahtarı: küçük harf, aksansız, tek boşluk. "Líder " = "lider". */
export function adAnahtari(s) {
  return String(s || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/ı/g, 'i').replace(/İ/g, 'i')
    .toLowerCase().replace(/\s+/g, ' ').trim();
}

const KISISEL = /^(kişisel|kisisel|personal|benim|mio|mía|mia)$/i;
const BIN = /^(k|bin|mil|lucas?|luca)$/i;

/** Bir kelimeyi tutara çevir; tutar değilse null. */
function tutarOku(kelime, sonraki) {
  const w = String(kelime).replace(/^\$/, '');
  let m = w.match(/^(\d+)(?:[.,](\d{1,2}))?(k)?$/i);
  let deger = null;
  if (m) {
    deger = Number(m[1] + (m[2] ? '.' + m[2] : ''));
    if (m[3]) deger *= 1000;
  } else if ((m = w.match(/^\d{1,3}(?:\.\d{3})+$/))) {
    deger = Number(w.replace(/\./g, ''));                    // 45.990 · 1.250.000
  } else if ((m = w.match(/^(\d{1,3}(?:\.\d{3})+),(\d{1,2})$/))) {
    deger = Number(m[1].replace(/\./g, '') + '.' + m[2]);    // 1.250,50
  }
  if (deger === null || !Number.isFinite(deger)) return null;
  const binlik = sonraki && BIN.test(sonraki);
  return { deger: binlik ? deger * 1000 : deger, yut: binlik ? 2 : 1 };
}

/**
 * "jumbo 45990" → { merchant: 'jumbo', amount: 45990, personal: false }
 * Tutar yoksa amount null. Birden fazla sayı varsa ilki tutar sayılır.
 */
export function hizliCoz(metin) {
  const kelimeler = String(metin || '').trim().split(/\s+/).filter(Boolean);
  // "45 990" gibi boşluklu binlikleri önce birleştir.
  const birlesik = [];
  for (let i = 0; i < kelimeler.length; i++) {
    const w = kelimeler[i];
    if (/^\d{1,3}$/.test(w) && /^\d{3}$/.test(kelimeler[i + 1] || '')) {
      let s = w; let j = i + 1;
      while (/^\d{3}$/.test(kelimeler[j] || '')) { s += kelimeler[j]; j++; }
      birlesik.push(s); i = j - 1;
    } else birlesik.push(w);
  }
  let amount = null; let personal = false; const ad = [];
  for (let i = 0; i < birlesik.length; i++) {
    const w = birlesik[i];
    if (KISISEL.test(w)) { personal = true; continue; }
    if (amount === null) {
      const t = tutarOku(w, birlesik[i + 1]);
      if (t) { amount = Math.round(t.deger * 100) / 100; i += t.yut - 1; continue; }
    }
    ad.push(w);
  }
  return { merchant: ad.join(' '), amount, personal };
}

/**
 * Öğrenilmiş mağaza listesinden (merchant_categories) eşleşme.
 * Önce tam eşleşme, yoksa başıyla eşleşen en sık kullanılan (en az 3 harf).
 */
export function magazaBul(liste, ad) {
  const k = adAnahtari(ad);
  if (!k || !Array.isArray(liste)) return null;
  const tam = liste.find((x) => adAnahtari(x.merchant) === k);
  if (tam) return tam;
  if (k.length < 3) return null;
  const bas = liste.filter((x) => adAnahtari(x.merchant).startsWith(k));
  return bas.length ? [...bas].sort((a, b) => (b.uses || 0) - (a.uses || 0))[0] : null;
}

/**
 * Geçmişten öğren (demo deposu ve testler için; canlıda aynısını SQL yapıyor):
 * her mağaza için en sık kullanılan kategori.
 */
export function magazaOgren(islemler) {
  const say = new Map();   // anahtar → { ad, son, kat: Map(cat → n) }
  for (const t of islemler || []) {
    if (t.kind !== 'expense' || !t.merchant || !t.category_id || t.masked) continue;
    const k = adAnahtari(t.merchant);
    if (!k) continue;
    const e = say.get(k) || { ad: t.merchant, son: '', kat: new Map() };
    if ((t.occurred_on || '') >= e.son) { e.son = t.occurred_on || ''; e.ad = t.merchant; }
    e.kat.set(t.category_id, (e.kat.get(t.category_id) || 0) + 1);
    say.set(k, e);
  }
  return [...say.values()].map((e) => {
    const [category_id, uses] = [...e.kat.entries()].sort((a, b) => b[1] - a[1])[0];
    return { merchant: e.ad, category_id, uses, last_on: e.son };
  }).sort((a, b) => b.uses - a.uses || b.last_on.localeCompare(a.last_on));
}
