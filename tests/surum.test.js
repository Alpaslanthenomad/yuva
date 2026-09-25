import { test } from 'node:test';
import assert from 'node:assert/strict';
import { yenilemeliMi } from '../lib/surum.js';

test('yayındaki sürüm farklıysa yenilenir', () => {
  assert.equal(yenilemeliMi('aaaaaaa', 'bbbbbbb', null), true);
});

test('aynı sürümdeyse dokunulmaz', () => {
  assert.equal(yenilemeliMi('aaaaaaa', 'aaaaaaa', null), false);
});

test('SONSUZ DÖNGÜ KORUMASI: aynı sürüm için ikinci kez yenilenmez', () => {
  // Sunucu bir sebeple hâlâ eski sayfayı veriyorsa telefon kendini durmadan
  // yenilerdi. Bu, güncellenmemekten çok daha kötü.
  assert.equal(yenilemeliMi('aaaaaaa', 'bbbbbbb', 'bbbbbbb'), false);
  // Ama ARDINDAN üçüncü bir sürüm çıkarsa yine yenilenir.
  assert.equal(yenilemeliMi('aaaaaaa', 'ccccccc', 'bbbbbbb'), true);
});

test('bilgi eksikse hiçbir şey yapılmaz', () => {
  // version.json ulaşılamadıysa ya da bozuksa sessizce devam edilir;
  // yenileme kullanıcının elindeki ekranı götürür, emin olmadan yapılmaz.
  assert.equal(yenilemeliMi('aaaaaaa', '', null), false);
  assert.equal(yenilemeliMi('aaaaaaa', null, null), false);
  assert.equal(yenilemeliMi('aaaaaaa', undefined, null), false);
  assert.equal(yenilemeliMi('', 'bbbbbbb', null), false);
  assert.equal(yenilemeliMi(undefined, 'bbbbbbb', null), false);
});

test('yerel geliştirmede de kural aynı', () => {
  assert.equal(yenilemeliMi('yerel', 'yerel', null), false);
});
