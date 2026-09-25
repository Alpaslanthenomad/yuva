import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// localStorage taklidi — node'da yok.
const kur = (bozuk = false) => {
  const depo = new Map();
  globalThis.localStorage = {
    getItem: (k) => { if (bozuk) throw new Error('özel mod'); return depo.has(k) ? depo.get(k) : null; },
    setItem: (k, v) => { if (bozuk) throw new Error('özel mod'); depo.set(k, String(v)); },
    removeItem: (k) => { if (bozuk) throw new Error('özel mod'); depo.delete(k); },
  };
  return depo;
};

const { okuSonEposta, yazSonEposta, silSonEposta, SON_EPOSTA_ANAHTAR } = await import('../lib/sonGiris.js');

test('yazılan e-posta geri okunur', () => {
  kur();
  yazSonEposta('  ali@ornek.com  ');
  assert.equal(okuSonEposta(), 'ali@ornek.com');
});

test('boş değer yazılmaz — var olanı ezmez', () => {
  const d = kur();
  yazSonEposta('ali@ornek.com');
  yazSonEposta('');
  yazSonEposta('   ');
  yazSonEposta(null);
  assert.equal(d.get(SON_EPOSTA_ANAHTAR), 'ali@ornek.com');
});

test('çıkışta siliniyor', () => {
  kur();
  yazSonEposta('ali@ornek.com');
  silSonEposta();
  assert.equal(okuSonEposta(), '');
});

test('ŞİFRE İÇİN BİR YOL YOK', () => {
  // Bu dosya bilinçli olarak yalnızca e-posta saklıyor. Şifreyi saklamak
  // tarayıcının ve işletim sisteminin işi; uygulama kendi deposuna yazmaz.
  const metin = readFileSync(new URL('../lib/sonGiris.js', import.meta.url), 'utf8');
  const kod = metin.split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');
  assert.ok(!/password|sifre|şifre/i.test(kod), 'kodda şifreye dair bir iz var');
  // Saklanan tek anahtar bu.
  assert.equal((kod.match(/localStorage\.setItem/g) || []).length, 1);
});

test('depo çalışmıyorsa uygulama patlamaz', () => {
  // Özel sekmede localStorage erişimi hata fırlatabiliyor. Giriş ekranı
  // bu yüzden açılmamalı değil.
  kur(true);
  assert.equal(okuSonEposta(), '');
  assert.doesNotThrow(() => yazSonEposta('ali@ornek.com'));
  assert.doesNotThrow(() => silSonEposta());
});
