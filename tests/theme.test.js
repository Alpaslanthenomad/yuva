import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolveTheme, THEMES, THEME_COLOR } from '../lib/theme.js';

test('Sistem seçiliyken cihazın kipi uygulanır', () => {
  assert.equal(resolveTheme('system', true), 'dark');
  assert.equal(resolveTheme('system', false), 'light');
});

test('AÇIK SEÇİM CİHAZI EZER — bu özelliğin varlık sebebi', () => {
  // Telefonu koyu kipte olan biri uygulamayı açık kipte görebilmeli; bunun
  // için telefonun tamamını değiştirmek zorunda kalmamalı.
  assert.equal(resolveTheme('light', true), 'light');
  assert.equal(resolveTheme('dark', false), 'dark');
});

test('bozuk ya da eksik tercih uygulamayı kilitlemez, sisteme düşer', () => {
  for (const bozuk of [null, undefined, '', 'zort', 'LIGHT', 0, {}]) {
    assert.equal(resolveTheme(bozuk, true), 'dark');
    assert.equal(resolveTheme(bozuk, false), 'light');
  }
});

test('üç seçenek var ve her birinin rengi tanımlı', () => {
  assert.deepEqual(THEMES, ['system', 'light', 'dark']);
  assert.ok(THEME_COLOR.light && THEME_COLOR.dark);
  assert.notEqual(THEME_COLOR.light, THEME_COLOR.dark);
});

test('KOYU KİP İKİ BLOĞU BİREBİR AYNI — biri güncellenip diğeri unutulmasın', () => {
  // tokens.css'te koyu renkler iki yerde: biri cihaz ayarı için (data-theme
  // henüz yokken), biri açık seçim için. Birine değişken eklenip diğerine
  // eklenmemesi, yalnızca belirli bir kipte görünen bir renk hatası üretir —
  // fark edilmesi en zor hata türü.
  const css = readFileSync(new URL('../styles/tokens.css', import.meta.url), 'utf8');

  const blok = (baslangic) => {
    const i = css.indexOf(baslangic);
    assert.notEqual(i, -1, `blok bulunamadı: ${baslangic}`);
    const govde = css.slice(i + baslangic.length);
    const son = govde.indexOf('}');
    return Object.fromEntries(govde.slice(0, son).split('\n')
      .map((l) => l.trim()).filter((l) => l.startsWith('--'))
      .map((l) => { const [k, ...v] = l.replace(/;$/, '').split(':'); return [k.trim(), v.join(':').trim()]; }));
  };

  const sistem = blok(':root:not([data-theme]) {');
  const acikSecim = blok(':root[data-theme="dark"] {');

  assert.ok(Object.keys(sistem).length >= 15, 'sistem bloğu beklenenden küçük');
  assert.deepEqual(Object.keys(acikSecim).sort(), Object.keys(sistem).sort());
  assert.deepEqual(acikSecim, sistem);
});

test('açılış betiği koyu kipi boyamadan önce yazıyor', () => {
  // Bu betik <head> içinde çalışmazsa koyu kipteki telefonda her açılışta
  // beyaz parlama olur. Varlığı ve try/catch'i testli: hata verirse uygulama
  // hiç açılmaz.
  const layout = readFileSync(new URL('../app/layout.jsx', import.meta.url), 'utf8');
  assert.match(layout, /yuva:theme/);
  assert.match(layout, /dataset\.theme/);
  assert.match(layout, /try\{/);
  assert.match(layout, /<head>/);
});
