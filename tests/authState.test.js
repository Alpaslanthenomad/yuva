import { test } from 'node:test';
import assert from 'node:assert/strict';
import { authScreen } from '../lib/authState.js';

const U = { id: 'u1' };
const H = { id: 'h1', name: 'Bizim Ev' };

test('ŞİFRE EKRANI YALNIZCA OTURUM YOKKEN çıkar', () => {
  // Bu testin sebebi gerçek bir hata: açılış çağrısı patlayınca oturum da
  // düşürülüyordu ve kullanıcı girişliyken şifre ekranına atılıyordu.
  // Telefonda ağ bir saniye kesildiğinde bile oluyordu.
  assert.equal(authScreen({ loading: false, user: U, household: null, bootstrapFailed: true }), 'retry');
  assert.notEqual(authScreen({ loading: false, user: U, household: null, bootstrapFailed: true }), 'login');
});

test('oturum yoksa giriş ekranı', () => {
  assert.equal(authScreen({ loading: false, user: null, household: null }), 'login');
  assert.equal(authScreen({ loading: false }), 'login');
});

test('oturum ve hane varsa uygulama', () => {
  assert.equal(authScreen({ loading: false, user: U, household: H }), 'app');
  // Eski bir hata bayrağı kalmış olsa bile hane varsa uygulama açılır.
  assert.equal(authScreen({ loading: false, user: U, household: H, bootstrapFailed: true }), 'app');
});

test('oturum var, hanesi gerçekten yok → kurulum', () => {
  assert.equal(authScreen({ loading: false, user: U, household: null, bootstrapFailed: false }), 'setup');
  assert.equal(authScreen({ loading: false, user: U, household: null }), 'setup');
});

test('yükleme sürerken hiçbir karar verilmez', () => {
  assert.equal(authScreen({ loading: true }), 'loading');
  assert.equal(authScreen({ loading: true, user: U, household: null, bootstrapFailed: true }), 'loading');
});

test('demo kipinde giriş hiç sorulmaz', () => {
  assert.equal(authScreen({ loading: false, user: null, household: null }, 'demo'), 'app');
});

test('bozuk/boş durum uygulamayı açmaz, girişe düşer', () => {
  assert.equal(authScreen(undefined), 'login');
  assert.equal(authScreen(null), 'login');
});
