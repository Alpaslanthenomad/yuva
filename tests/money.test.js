import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseAmount, formatMoney, convert, budgetState, minorToDecimal } from '../lib/money.js';

test('parseAmount CLP: binlik nokta, ondalık yok', () => {
  assert.equal(parseAmount('12.345', 'CLP'), 12345);
  assert.equal(parseAmount('12345', 'CLP'), 12345);
  assert.equal(parseAmount('1.250.000', 'CLP'), 1250000);
});
test('parseAmount TRY: virgül ondalık', () => {
  assert.equal(parseAmount('1.850,50', 'TRY'), 185050);
  assert.equal(parseAmount('1850.5', 'TRY'), 185050);
  assert.equal(parseAmount('45', 'TRY'), 4500);
});
test('parseAmount geçersiz', () => {
  assert.equal(parseAmount('', 'CLP'), null);
  assert.equal(parseAmount('abc', 'CLP'), null);
  assert.equal(parseAmount('-5', 'CLP'), null);
});
test('minorToDecimal', () => {
  assert.equal(minorToDecimal(185050, 'TRY'), 1850.5);
  assert.equal(minorToDecimal(12345, 'CLP'), 12345);
});
test('formatMoney', () => {
  assert.equal(formatMoney(950000, 'CLP'), '$950.000');
  assert.equal(formatMoney(1850.5, 'TRY'), '₺1.850,50');
  assert.equal(formatMoney(-240, 'USD'), '−US$240,00');
  assert.equal(formatMoney(2400000, 'CLP', { compact: true }), '$2,4M');
});
test('convert: doğrudan, ters ve USD çapraz', () => {
  const rates = { USDCLP: 940, USDTRY: 44.5 };
  assert.equal(convert(1, 'USD', 'CLP', rates), 940);
  assert.equal(Math.round(convert(940, 'CLP', 'USD', rates)), 1);
  assert.equal(Math.round(convert(44.5, 'TRY', 'CLP', rates)), 940);
  assert.equal(convert(5, 'CLP', 'CLP', rates), 5);
  assert.equal(convert(5, 'CLP', 'GBP', rates), null);
});
test('budgetState eşikleri', () => {
  assert.equal(budgetState(50, 100).state, 'ok');
  assert.equal(budgetState(85, 100).state, 'warn');
  assert.equal(budgetState(120, 100).state, 'over');
  assert.equal(budgetState(120, 100).pct, 100);
  assert.equal(budgetState(10, 0).state, 'none');
});
