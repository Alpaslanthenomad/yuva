import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import tr from '../lib/i18n/tr.js';
import es from '../lib/i18n/es.js';
import { translate, makeT, normalizeLocale, LOCALE_CODES, DICTS } from '../lib/i18n/index.js';
import { setDateLocale, fmtDay, fmtDayLong, fmtPeriod, relativeLabel, dowNames } from '../lib/dates.js';
import { holidayMap, holidayName, holidaysCL } from '../lib/holidays.js';

/** Sözlüğü {'a.b.c': 'string'|'fn'} düz haritaya çevirir */
function flatten(obj, prefix = '', out = {}) {
  for (const [k, v] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${k}` : k;
    if (typeof v === 'function') out[path] = 'fn';
    else if (v && typeof v === 'object') flatten(v, path, out);
    else out[path] = typeof v;
  }
  return out;
}

test('TR ve ES sözlükleri birebir aynı anahtarlara sahip', () => {
  const a = flatten(tr), b = flatten(es);
  const missingInEs = Object.keys(a).filter((k) => !(k in b));
  const missingInTr = Object.keys(b).filter((k) => !(k in a));
  assert.deepEqual(missingInEs, [], 'es.js içinde eksik: ' + missingInEs.join(', '));
  assert.deepEqual(missingInTr, [], 'tr.js içinde eksik: ' + missingInTr.join(', '));
});

test('Aynı anahtar iki dilde de aynı tipte (metin ↔ fonksiyon)', () => {
  const a = flatten(tr), b = flatten(es);
  const mismatched = Object.keys(a).filter((k) => a[k] !== b[k]);
  assert.deepEqual(mismatched, [], 'tip uyuşmazlığı: ' + mismatched.join(', '));
});

test('Hiçbir çeviri boş değil', () => {
  for (const [code, dict] of Object.entries(DICTS)) {
    for (const [k, v] of Object.entries(flatten(dict))) {
      if (v === 'fn') continue;
      const val = k.split('.').reduce((o, x) => o[x], dict);
      assert.ok(String(val).trim().length > 0, `${code}: ${k} boş`);
    }
  }
});

test('Fonksiyon çevirileri argümanı kullanıyor', () => {
  assert.match(translate('tr', 'today.greeting', 'Ada'), /Ada/);
  assert.match(translate('es', 'today.greeting', 'Ada'), /Ada/);
  assert.match(translate('es', 'plans.daysLeft', 12), /12/);
  assert.match(translate('es', 'family.turns', 10), /10/);
  assert.match(translate('es', 'today.itemsLeft', 5), /5/);
});

test('normalizeLocale', () => {
  assert.equal(normalizeLocale('es-CL'), 'es');
  assert.equal(normalizeLocale('TR'), 'tr');
  assert.equal(normalizeLocale('tr-TR'), 'tr');
  assert.equal(normalizeLocale('de'), null);
  assert.equal(normalizeLocale(null), null);
  assert.deepEqual(LOCALE_CODES, ['tr', 'es']);
});

test('Bilinmeyen anahtar anahtarın kendisini döner, eksik ES anahtarı TR’ye düşer', () => {
  assert.equal(translate('es', 'yok.boyle.bir.sey'), 'yok.boyle.bir.sey');
  assert.equal(makeT('es').locale, 'es');
  assert.equal(makeT('de').locale, 'tr'); // desteklenmeyen dil → varsayılan
});

test('Tarih biçimleri dile göre değişiyor', () => {
  setDateLocale('tr');
  assert.equal(fmtDay('2026-09-20'), '20 Eylül');
  assert.equal(fmtPeriod('2026-09'), 'Eylül 2026');
  assert.equal(fmtDayLong('2026-09-20'), 'Pazar, 20 Eylül');
  assert.equal(relativeLabel('2026-09-21', '2026-09-20'), 'Yarın');
  assert.equal(dowNames()[0], 'Pzt');

  setDateLocale('es');
  assert.equal(fmtDay('2026-09-20'), '20 septiembre');
  assert.equal(fmtPeriod('2026-09'), 'septiembre 2026');
  assert.equal(fmtDayLong('2026-09-20'), 'domingo, 20 de septiembre');
  assert.equal(relativeLabel('2026-09-21', '2026-09-20'), 'Mañana');
  assert.equal(relativeLabel('2026-09-25', '2026-09-20'), 'en 5 días');
  assert.equal(dowNames()[0], 'Lun');

  setDateLocale('tr'); // testler arası sızıntı olmasın
});

test('Tatil adları iki dilde de çözülüyor', () => {
  const clTr = holidayMap(2026, ['CL'], 'tr');
  const clEs = holidayMap(2026, ['CL'], 'es');
  assert.equal(clEs['2026-09-18'][0].name, 'Fiestas Patrias');
  assert.equal(clTr['2026-09-18'][0].name, 'Bağımsızlık Bayramı (Fiestas Patrias)');

  const trTr = holidayMap(2026, ['TR'], 'tr');
  const trEs = holidayMap(2026, ['TR'], 'es');
  assert.equal(trTr['2026-10-29'][0].name, 'Cumhuriyet Bayramı');
  assert.equal(trEs['2026-10-29'][0].name, 'Día de la República');
  // Sayılı bayram günleri
  assert.match(trTr['2026-03-21'][0].name, /2\. gün/);
  assert.match(trEs['2026-03-21'][0].name, /día 2/);
});

test('Her tatil anahtarının iki dilde karşılığı var', () => {
  const keys = new Set(holidaysCL(2026).map((h) => h.key));
  for (const k of keys) {
    for (const loc of LOCALE_CODES) {
      const name = translate(loc, 'holidays.' + k);
      assert.notEqual(name, 'holidays.' + k, `${loc}: ${k} çevirisi yok`);
    }
  }
});

test('JSX dosyalarında sabit Türkçe metin kalmadı (CLAUDE.md kuralı)', () => {
  // Türkçe'ye özgü harfler + bilinen Türkçe kelimeler; i18n dosyaları hariç.
  const roots = ['app', 'components'];
  const suspects = [];
  const walk = (dir) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, e.name);
      if (e.isDirectory()) { walk(p); continue; }
      if (!/\.jsx?$/.test(p)) continue;
      // layout.jsx: sunucu bileşeni, hook kullanamaz; <head> metadata bilinçli olarak çift dilli.
      if (p.endsWith('app/layout.jsx')) continue;
      const src = readFileSync(p, 'utf8');
      src.split('\n').forEach((line, i) => {
        if (line.trim().startsWith('//') || line.trim().startsWith('*')) return;
        // JSX metin düğümü veya tırnaklı dizge içinde Türkçe'ye özgü harf
        const m = line.match(/["'>][^"'<>]*[çğıöşüÇĞİÖŞÜ][^"'<>]*["'<]/);
        if (m) suspects.push(`${p}:${i + 1} ${m[0].trim()}`);
      });
    }
  };
  roots.forEach(walk);
  assert.deepEqual(suspects, [], 'Sabit Türkçe metin bulundu:\n' + suspects.join('\n'));
});
