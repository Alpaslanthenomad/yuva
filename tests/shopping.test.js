import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  SHOPPING_GROUPS, SHOPPING_CATALOG, catalogName, normalizeName, findCatalogItem,
} from '../lib/shoppingCatalog.js';

test('katalog: her ürünün iki dilde adı ve bir emojisi var', () => {
  // Asıl mesele bu: ürün eklerken bir dili unutmak, o dilde boş düğme demek.
  const eksik = SHOPPING_CATALOG.filter((x) => !x.tr || !x.es || !x.emoji || !x.key || !x.group);
  assert.deepEqual(eksik.map((x) => x.key || '(anahtarsız)'), []);
});

test('katalog: anahtarlar benzersiz', () => {
  const seen = new Set(); const tekrar = [];
  for (const x of SHOPPING_CATALOG) { if (seen.has(x.key)) tekrar.push(x.key); seen.add(x.key); }
  assert.deepEqual(tekrar, []);
});

test('katalog: her ürün tanımlı bir reyona ait, her reyonda ürün var', () => {
  const groups = new Set(SHOPPING_GROUPS.map((g) => g.key));
  assert.deepEqual(SHOPPING_CATALOG.filter((x) => !groups.has(x.group)).map((x) => x.key), []);
  assert.deepEqual(
    SHOPPING_GROUPS.filter((g) => !SHOPPING_CATALOG.some((x) => x.group === g.key)).map((g) => g.key), []);
});

test('katalog: reyon adları da iki dilde', () => {
  assert.deepEqual(SHOPPING_GROUPS.filter((g) => !g.tr || !g.es || !g.emoji).map((g) => g.key), []);
});

test('katalog: aynı ad iki kez geçmiyor (ne Türkçede ne İspanyolcada)', () => {
  // Aynı adla iki kayıt olursa "listede zaten var" işareti yanlış ürüne düşerdi.
  for (const dil of ['tr', 'es']) {
    const seen = new Set(); const tekrar = [];
    for (const x of SHOPPING_CATALOG) {
      const n = normalizeName(x[dil]);
      if (seen.has(n)) tekrar.push(`${dil}:${x[dil]}`);
      seen.add(n);
    }
    assert.deepEqual(tekrar, []);
  }
});

test('catalogName: dile göre ad, bilinmeyen dilde Türkçe', () => {
  const domates = SHOPPING_CATALOG.find((x) => x.key === 'tomato');
  assert.equal(catalogName(domates, 'tr'), 'Domates');
  assert.equal(catalogName(domates, 'es'), 'Tomate');
  assert.equal(catalogName(domates, 'es-CL'), 'Tomate');
  assert.equal(catalogName(domates, 'de'), 'Domates');
  assert.equal(catalogName(domates, undefined), 'Domates');
  assert.equal(catalogName(null, 'tr'), '');
});

test('normalizeName: büyük/küçük harf ve boşluk önemsiz, Türkçe İ doğru küçülür', () => {
  assert.equal(normalizeName('  Domates '), normalizeName('domates'));
  assert.equal(normalizeName('SÜT'), normalizeName('süt'));
  // 'İ'.toLowerCase() varsayılan yerelde 'i̇' üretiyor ve eşleşme kaçıyordu.
  assert.equal(normalizeName('İki'), 'iki');
  assert.equal(normalizeName(null), '');
});

test('normalizeName: parantez içindeki miktar eşleşmeyi bozmaz', () => {
  // Gerçek listede "Süt (2 L)" yazıyor; katalogdaki "Süt" ile eşleşmezse
  // ızgara işaretsiz görünür ve dokunuş ikinci bir "Süt" ekler.
  assert.equal(normalizeName('Süt (2 L)'), normalizeName('Süt'));
  assert.equal(normalizeName('Ekmek  (tam buğday)'), 'ekmek');
  assert.equal(findCatalogItem('Süt (2 L)')?.key, 'milk');
  assert.equal(findCatalogItem('Yumurta (30 lu)')?.key, 'eggs');
  // Parantezsiz farklı ürün yine karışmamalı.
  assert.equal(findCatalogItem('Sütlaç'), null);
});

test('findCatalogItem: listedeki ad iki dilde de bulunur', () => {
  assert.equal(findCatalogItem('Tomate')?.key, 'tomato');
  assert.equal(findCatalogItem('domates')?.key, 'tomato');
  assert.equal(findCatalogItem('  PAN  ')?.key, 'bread');
  assert.equal(findCatalogItem('bulgur'), null);
});
