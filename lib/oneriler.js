// lib/oneriler.js — akıllı önerilerin demo aynası.
//
// ASIL HESAP VERİTABANINDA (0024: expense_suggestions, restock_suggestions).
// Bu dosya demo kipinin aynı sonucu vermesi ve kuralların testle sabitlenmesi
// için var. Bir kural değişirse SQL ile birlikte değişmeli.
import { daysBetween, fromISODate } from './dates.js';

const ortanca = (dizi) => {
  const s = [...dizi].sort((a, b) => a - b);
  if (!s.length) return 0;
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const isoGun = (iso) => ((fromISODate(iso).getDay() + 6) % 7) + 1;   // 1=Pzt … 7=Paz
const ondalik = (ccy) => (['CLP', 'JPY', 'KRW'].includes(ccy) ? 0 : 2);

/**
 * Alışkanlıktan harcama önerisi.
 * - Son 120 gün, gider, otomatik düzenli gider hariç, yeri boş olmayan.
 * - Aynı yer (büyük/küçük harf ve boşluk fark etmez) + kategori + para birimi.
 * - En az 2 kez. Puan: yakınlık (45 günde e kat) × aynı haftanın günü ise 1,5.
 * - Tutar ortanca: tek büyük alışveriş öneriyi kaydırmasın.
 */
export function harcamaOnerileri(txns, dateISO, limit = 4) {
  const gruplar = new Map();
  const bugunGun = isoGun(dateISO);
  for (const t of txns || []) {
    if (t.kind !== 'expense' || t.recurring_id) continue;
    const ad = String(t.merchant || '').trim();
    if (!ad) continue;
    const once = daysBetween(t.occurred_on, dateISO);
    if (once < 0 || once > 120) continue;
    const anahtar = [ad.toLowerCase(), t.category_id || '', t.currency].join('|');
    const g = gruplar.get(anahtar) || { merchant: ad, category_id: t.category_id || null, currency: t.currency,
      account_id: t.account_id || null, tutarlar: [], puan: 0, son: '' };
    g.tutarlar.push(Number(t.amount));
    g.puan += Math.exp(-once / 45) * (isoGun(t.occurred_on) === bugunGun ? 1.5 : 1);
    if (t.occurred_on > g.son) { g.son = t.occurred_on; g.merchant = ad; g.account_id = t.account_id || g.account_id; }
    gruplar.set(anahtar, g);
  }
  return [...gruplar.values()]
    .filter((g) => g.tutarlar.length >= 2)
    .sort((a, b) => b.puan - a.puan)
    .slice(0, Math.max(1, Math.min(limit, 8)))
    .map((g) => {
      const k = 10 ** ondalik(g.currency);
      return {
        merchant: g.merchant, category_id: g.category_id, currency: g.currency, account_id: g.account_id,
        amount: Math.round(ortanca(g.tutarlar) * k) / k, uses: g.tutarlar.length, last_on: g.son,
      };
    });
}

/**
 * "Bitmiş olabilir": bir ürün en az 3 ayrı günde yazıldıysa tipik aralığı
 * (ortanca) bulunur; son yazılıştan bu yana o kadar gün geçtiyse önerilir.
 * 2 günden sık ve 60 günden seyrek olanlar dışarıda.
 * @param {{catalog_key:string, added_on:string}[]} log
 */
export function bitmisOlabilir(log, dateISO, limit = 6) {
  const urun = new Map();
  for (const r of log || []) {
    const once = daysBetween(r.added_on, dateISO);
    if (once < 0 || once > 180) continue;
    const s = urun.get(r.catalog_key) || new Set();
    s.add(r.added_on);
    urun.set(r.catalog_key, s);
  }
  const sonuc = [];
  for (const [key, set] of urun) {
    if (set.size < 3) continue;
    const gunler = [...set].sort();
    const aralar = gunler.slice(1).map((d, i) => daysBetween(gunler[i], d));
    const tipik = ortanca(aralar);
    const gecen = daysBetween(gunler[gunler.length - 1], dateISO);
    if (tipik < 2 || tipik > 60 || gecen < tipik * 0.9) continue;
    sonuc.push({ catalog_key: key, every_days: Math.round(tipik), days_since: gecen, _oran: gecen / Math.max(tipik, 1) });
  }
  return sonuc.sort((a, b) => b._oran - a._oran)
    .slice(0, Math.max(1, Math.min(limit, 12)))
    .map(({ _oran, ...r }) => r);
}
