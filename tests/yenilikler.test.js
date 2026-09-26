// tests/yenilikler.test.js — tek seferlik Yenilikler kartı.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import tr from '../lib/i18n/tr.js';
import es from '../lib/i18n/es.js';
import { YENILIKLER, YENILIK_SURUMU, gorulduMu, gorulduYap } from '../lib/yenilikler.js';

test('her yeniliğin iki dilde başlığı ve açıklaması var, bağlantısı var olan sayfaya gidiyor', () => {
  for (const y of YENILIKLER) {
    for (const d of [tr, es]) {
      assert.ok(d.whatsNew.items[y.key]?.title, `${y.key} başlık`);
      assert.ok(d.whatsNew.items[y.key]?.body, `${y.key} açıklama`);
    }
    const yol = new URL(y.href, 'https://x').pathname;
    const sayfa = yol === '/' ? 'app/page.jsx' : `app${yol}page.jsx`;
    assert.ok(existsSync(new URL('../' + sayfa, import.meta.url)), `${y.key}: ${sayfa}`);
  }
});

test('kart bir kez görülünce bu sürüm için kapanır; depo kapalıysa hiç çıkmaz', () => {
  const m = new Map();
  const depo = { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v) };
  assert.equal(gorulduMu(depo), false);
  gorulduYap(depo);
  assert.equal(gorulduMu(depo), true);
  m.set('yuva:yenilikler:gordu', 'eski-' + YENILIK_SURUMU);
  assert.equal(gorulduMu(depo), false, 'yeni sürüm yeniden gösterilir');
  const kapali = { getItem: () => { throw new Error('x'); }, setItem: () => { throw new Error('x'); } };
  assert.equal(gorulduMu(kapali), true);
});
