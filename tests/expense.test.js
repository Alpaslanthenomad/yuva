import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EXPENSE_PRESETS, presetName, presetCategoryId } from '../lib/expenseCatalog.js';

// 0002'de tohumlanan kategorilerin aynısı (TR ve ES).
const TR = [
  { id: 'u',  name: 'Ulaşım',               kind: 'expense', parent_id: null },
  { id: 'u1', name: 'Yakıt',                kind: 'expense', parent_id: 'u' },
  { id: 'u2', name: 'Toplu taşıma',         kind: 'expense', parent_id: 'u' },
  { id: 'u3', name: 'Taksi / Uber',         kind: 'expense', parent_id: 'u' },
  { id: 'u4', name: 'Araç bakım & sigorta', kind: 'expense', parent_id: 'u' },
  { id: 'u5', name: 'Otopark & Geçiş',      kind: 'expense', parent_id: 'u' },
  { id: 'm',  name: 'Market',               kind: 'expense', parent_id: null },
  { id: 'g',  name: 'Maaş',                 kind: 'income',  parent_id: null },
];
const ES = [
  { id: 'u',  name: 'Transporte',            kind: 'expense', parent_id: null },
  { id: 'u1', name: 'Bencina',               kind: 'expense', parent_id: 'u' },
  { id: 'u2', name: 'Transporte público',    kind: 'expense', parent_id: 'u' },
  { id: 'u3', name: 'Taxi / Uber',           kind: 'expense', parent_id: 'u' },
  { id: 'u5', name: 'Estacionamiento y TAG', kind: 'expense', parent_id: 'u' },
];
const by = (k) => EXPENSE_PRESETS.find((x) => x.key === k);

test('hazır harcama: her kaydın iki dilde adı, emojisi ve deseni var', () => {
  const eksik = EXPENSE_PRESETS.filter((x) => !x.tr || !x.es || !x.emoji || !x.key || !x.cat);
  assert.deepEqual(eksik.map((x) => x.key || '(anahtarsız)'), []);
  const seen = new Set(); const tekrar = [];
  for (const x of EXPENSE_PRESETS) { if (seen.has(x.key)) tekrar.push(x.key); seen.add(x.key); }
  assert.deepEqual(tekrar, []);
});

test('Uber doğru ALT kategoriye düşer, üst kategoriye değil', () => {
  // Asıl mesele: "Ulaşım" genel; harcama "Taksi / Uber" altına yazılmalı ki
  // bütçe kırılımı anlamlı olsun.
  assert.equal(presetCategoryId(by('uber'), TR), 'u3');
  assert.equal(presetCategoryId(by('uber'), ES), 'u3');
});

test('her ulaşım seçimi Türkçe kategorilerde bir yere düşer', () => {
  const bosta = EXPENSE_PRESETS
    .filter((p) => p.group === 'transport')
    .filter((p) => !presetCategoryId(p, TR))
    .map((p) => p.key);
  assert.deepEqual(bosta, []);
});

test('alt kategori yoksa üst kategoriye düşülür', () => {
  // Uçak için ayrı alt kategori yok; "Ulaşım" üstüne düşmeli.
  assert.equal(presetCategoryId(by('plane'), TR), 'u');
  // Otobüs, metro ve tren aynı alt kategoriyi paylaşır.
  assert.equal(presetCategoryId(by('bus'), TR), 'u2');
  assert.equal(presetCategoryId(by('metro'), TR), 'u2');
  assert.equal(presetCategoryId(by('train'), TR), 'u2');
});

test('hiçbir şey eşleşmezse BOŞ döner, yanlış kategoriye yazmaz', () => {
  // Hane kategorilerini yeniden adlandırmış olabilir. Boş kategori göze
  // çarpar; yanlış kategori sessizce bütçeyi bozar.
  const garip = [{ id: 'x', name: 'Zort', kind: 'expense', parent_id: null }];
  assert.equal(presetCategoryId(by('uber'), garip), '');
  assert.equal(presetCategoryId(by('uber'), []), '');
  assert.equal(presetCategoryId(null, TR), '');
});

test('gelir kategorileri asla seçilmez', () => {
  const sadeceGelir = [{ id: 'g', name: 'Ulaşım', kind: 'income', parent_id: null }];
  assert.equal(presetCategoryId(by('uber'), sadeceGelir), '');
});

// Hanenin GERÇEK kategori yapısı (Supabase'den okundu): Market üst kategori,
// altında Gıda / Temizlik / Kişisel bakım.
const GERCEK = [
  { id: 'm',  name: 'Market',            kind: 'expense', parent_id: null },
  { id: 'm1', name: 'Gıda',              kind: 'expense', parent_id: 'm' },
  { id: 'm2', name: 'Temizlik',          kind: 'expense', parent_id: 'm' },
  { id: 'm3', name: 'Kişisel bakım',     kind: 'expense', parent_id: 'm' },
  { id: 'e',  name: 'Eğlence & Sosyal',  kind: 'expense', parent_id: null },
  { id: 's',  name: 'Sağlık',            kind: 'expense', parent_id: null },
  { id: 's3', name: 'Eczane',            kind: 'expense', parent_id: 's' },
];

test('MARKET SEÇİMLERİ VAR — en sık girilen harcama buydu ve eksikti', () => {
  // Kullanıcının uyarısı: hazır seçimlerde ulaşım ve restoran vardı, market
  // yoktu. "Lider'e 40.000 verdik" üç dokunuşta kaydedilebilmeli.
  const market = EXPENSE_PRESETS.filter((p) => p.group === 'market');
  assert.ok(market.length >= 5, 'market seçimi yok ya da çok az');
  // Listede en başta olmalı: en sık dokunulan başta.
  assert.equal(EXPENSE_PRESETS[0].group, 'market');
});

test('market seçimleri ÜST kategori "Market"e düşer, "Gıda" altına değil', () => {
  // Bir market alışverişi gıdayla birlikte temizlik ve kişisel bakım da
  // içerir; tek bir alt kategoriye yazmak bütçe kırılımını yanıltır.
  for (const p of EXPENSE_PRESETS.filter((x) => x.group === 'market')) {
    assert.equal(presetCategoryId(p, GERCEK), 'm', `${p.tr} yanlış kategoriye düştü`);
  }
});

test('spor ve eczane doğru yere düşer', () => {
  assert.equal(presetCategoryId(by('sport'), GERCEK), 'e');
  assert.equal(presetCategoryId(by('pharmacy'), GERCEK), 's3');
});

test('HİÇBİR SEÇİM BOŞTA KALMIYOR — hanenin gerçek kategorileriyle', () => {
  const bosta = EXPENSE_PRESETS.filter((p) => !presetCategoryId(p, [
    ...GERCEK,
    { id: 'u',  name: 'Ulaşım',     kind: 'expense', parent_id: null },
    { id: 'u1', name: 'Yakıt',      kind: 'expense', parent_id: 'u' },
    { id: 'u2', name: 'Toplu taşıma', kind: 'expense', parent_id: 'u' },
    { id: 'u3', name: 'Taksi / Uber', kind: 'expense', parent_id: 'u' },
    { id: 'u4', name: 'Araç bakım & sigorta', kind: 'expense', parent_id: 'u' },
    { id: 'u5', name: 'Otopark & Geçiş', kind: 'expense', parent_id: 'u' },
    { id: 'y',  name: 'Yeme-İçme',  kind: 'expense', parent_id: null },
    { id: 'y1', name: 'Restoran',   kind: 'expense', parent_id: 'y' },
    { id: 'y2', name: 'Kafe',       kind: 'expense', parent_id: 'y' },
    { id: 'y3', name: 'Sipariş',    kind: 'expense', parent_id: 'y' },
    { id: 'sy', name: 'Seyahat',    kind: 'expense', parent_id: null },
  ])).map((p) => p.tr);
  assert.deepEqual(bosta, []);
});

test('presetName: dile göre ad', () => {
  assert.equal(presetName(by('bus'), 'tr'), 'Otobüs');
  assert.equal(presetName(by('bus'), 'es-CL'), 'Bus');
  assert.equal(presetName(by('bus'), 'de'), 'Otobüs');
  assert.equal(presetName(null, 'tr'), '');
});
