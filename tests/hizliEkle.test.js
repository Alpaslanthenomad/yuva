import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const quick = readFileSync(new URL('../components/QuickAdd.jsx', import.meta.url), 'utf8');

// Bu dosya tek bir hatanın nöbetçisi. Emoji ızgarası yalnızca
// Aile > Alışveriş ekranında, bir düğmenin arkasındaydı. Kullanıcı onu bir kez
// buldu, sonra en çok kullanılan yere — alttaki "+" düğmesine — bastığında
// karşısında yine yazı kutusu çıktı ve özelliğin kaybolduğunu sandı.
// İsteğin kendisi "yazma işi olmasın"dı.

test('"+" > Alışveriş EMOJİ IZGARASINI açar, yazı kutusunu değil', () => {
  assert.match(quick, /import ShoppingPicker from '\.\/ShoppingPicker\.jsx'/);
  assert.match(quick, /tab === 'shopping' && <ShoppingQuickPick/);
  // Izgara yazı kutusundan ÖNCE çiziliyor.
  const i = quick.indexOf('export function ShoppingQuickPick');
  assert.notEqual(i, -1);
  const govde = quick.slice(i);
  assert.ok(govde.indexOf('<ShoppingPicker') < govde.indexOf('<ShoppingForm'),
    'yazı kutusu ızgaranın üstüne çıkmış');
});

test('yazı kutusu SİLİNMEDİ — katalogda olmayan şey yazılabilmeli', () => {
  const i = quick.indexOf('export function ShoppingQuickPick');
  assert.match(quick.slice(i), /<ShoppingForm/);
});

test('KLAVYE KENDİLİĞİNDEN AÇILMIYOR — ızgarayı örterdi', () => {
  // autoFocus artık isteğe bağlı ve varsayılan kapalı; hiçbir yerden
  // açık geçilmiyor.
  assert.match(quick, /ShoppingForm\(\{ onDone, listId, autoFocus = false \}\)/);
  assert.match(quick, /autoFocus=\{autoFocus\}/);
  assert.ok(!/<ShoppingForm[^>]*autoFocus(?!=\{autoFocus\})/.test(quick));
  const aile = readFileSync(new URL('../app/aile/page.jsx', import.meta.url), 'utf8');
  assert.ok(!/<ShoppingForm[^>]*autoFocus/.test(aile));
});
