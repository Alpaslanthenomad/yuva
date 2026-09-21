// lib/money.js — para birimi saf fonksiyonları (float yok; en küçük birim tam sayı)
// Dil bağımsızdır: tr-TR ve es-CL sayı biçimi aynıdır (binlik ".", ondalık ","),
// yine de biçimlendirme locale parametresi kabul eder. Para birimi ADLARI i18n'dedir (t('currencies.CLP')).

export const CURRENCIES = {
  CLP: { symbol: '$', decimals: 0, flag: '🇨🇱' },
  TRY: { symbol: '₺', decimals: 2, flag: '🇹🇷' },
  USD: { symbol: 'US$', decimals: 2, flag: '🇺🇸' },
  EUR: { symbol: '€', decimals: 2, flag: '🇪🇺' },
};

export const CURRENCY_CODES = Object.keys(CURRENCIES);
const NUM_LOCALE = 'tr-TR'; // es-CL ile aynı biçim: 1.234.567,89

/** "12.345,50" | "12345.5" | "12 345" → en küçük birim tam sayı (CLP: peso, TRY: kuruş) */
export function parseAmount(input, currency = 'CLP') {
  if (input == null) return null;
  const dec = CURRENCIES[currency]?.decimals ?? 2;
  let s = String(input).trim().replace(/\s/g, '');
  if (!s) return null;
  // Türkçe/Şili biçimi: nokta binlik, virgül ondalık. Son ayırıcı ondalık kabul edilir.
  const lastComma = s.lastIndexOf(',');
  const lastDot = s.lastIndexOf('.');
  if (lastComma > lastDot) {
    s = s.replace(/\./g, '').replace(',', '.');
  } else if (lastDot > lastComma) {
    // 12,345.50 → 12345.50 ; 12.345 (CLP binlik) → 12345
    const afterDot = s.length - lastDot - 1;
    if (dec === 0 && afterDot === 3) s = s.replace(/\./g, '');
    else s = s.replace(/,/g, '');
  }
  const n = Number(s);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 10 ** dec);
}

/** en küçük birim → ondalıklı sayı (DB numeric için) */
export function minorToDecimal(minor, currency = 'CLP') {
  const dec = CURRENCIES[currency]?.decimals ?? 2;
  return minor / 10 ** dec;
}

export function decimalToMinor(value, currency = 'CLP') {
  const dec = CURRENCIES[currency]?.decimals ?? 2;
  return Math.round(Number(value) * 10 ** dec);
}

/** Görüntü biçimi. amount: ondalıklı (DB'den gelen) */
export function formatMoney(amount, currency = 'CLP', { sign = false, compact = false, locale = NUM_LOCALE } = {}) {
  const c = CURRENCIES[currency] || { symbol: currency + ' ', decimals: 2 };
  const n = Number(amount) || 0;
  const abs = Math.abs(n);
  let body;
  if (compact && abs >= 1_000_000) body = (abs / 1_000_000).toLocaleString(locale, { maximumFractionDigits: 1 }) + 'M';
  else if (compact && abs >= 10_000) body = Math.round(abs / 1000).toLocaleString(locale) + 'K';
  else body = abs.toLocaleString(locale, { minimumFractionDigits: c.decimals, maximumFractionDigits: c.decimals });
  return (sign && n > 0 ? '+' : n < 0 ? '−' : '') + c.symbol + body;
}

/** Kur çevirimi (rates: {[`${from}${to}`]: rate}), USD üzerinden çapraz */
export function convert(amount, from, to, rates) {
  if (from === to) return Number(amount);
  const direct = rates[from + to];
  if (direct) return amount * direct;
  const inv = rates[to + from];
  if (inv) return amount / inv;
  const a = rates['USD' + to], b = rates['USD' + from];
  if (a && b) return (amount / b) * a;
  return null;
}

/** Bütçe yüzdesi → durum */
export function budgetState(spent, budget) {
  if (!budget || budget <= 0) return { pct: 0, state: 'none' };
  const pct = (spent / budget) * 100;
  return { pct: Math.min(pct, 100), state: pct >= 100 ? 'over' : pct >= 80 ? 'warn' : 'ok', rawPct: pct };
}

/** Ayın kalan günlerine göre günlük harcanabilir */
export function dailyAllowance(remaining, today = new Date()) {
  const y = today.getFullYear(), m = today.getMonth();
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const left = daysInMonth - today.getDate() + 1;
  return left > 0 ? remaining / left : remaining;
}
