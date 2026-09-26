// tests/planlar.test.js — plan kategorileri (0025).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PLAN_GROUPS, PLAN_CATEGORIES, planCategory, categoryList, planSection } from '../lib/planCatalog.js';

test('her kategorinin iki dilde adı, emojisi, grubu ve davranışı var', () => {
  const kinds = ['trip', 'gathering', 'project', 'goal'];
  const groups = new Set(PLAN_GROUPS.map((g) => g.key));
  const eksik = PLAN_CATEGORIES.filter((c) => !c.tr || !c.es || !c.emoji || !groups.has(c.group) || !kinds.includes(c.kind));
  assert.deepEqual(eksik.map((c) => c.key), []);
});

test('hazır listeler iki dilde', () => {
  const eksik = PLAN_CATEGORIES.flatMap((c) => c.list.filter((x) => !x[0] || !x[1]).map(() => c.key));
  assert.deepEqual(eksik, []);
  assert.equal(categoryList(planCategory('visit'), 'es-CL')[0], 'Llevar un regalo o postre');
});

test('MİSAFİRLİĞE GİTMEK VAR ve varsayılan olarak parası yok', () => {
  // Kullanıcının örneği: "arkadaşlar evine davet etti, bunu planlayamıyorum."
  const c = planCategory('visit');
  assert.equal(c.money, false);
  assert.equal(c.guests, false);   // misafir listesi ağırlarken anlamlı, giderken değil
});

test('eski planlar (kategorisiz) türünden tahmin edilir', () => {
  assert.equal(planCategory({ kind: 'trip' }).key, 'trip');
  assert.equal(planCategory({ kind: 'gathering' }).key, 'host');
  assert.equal(planCategory({ kind: 'goal' }).key, 'goal');
  assert.equal(planCategory({}).key, 'other');
});

test('bölümler: yaklaşan, fikir, hedef, geçmiş', () => {
  const T = '2026-09-26';
  assert.equal(planSection({ kind: 'gathering', status: 'planned', starts_on: '2026-09-27' }, T), 'upcoming');
  assert.equal(planSection({ kind: 'trip', status: 'active', starts_on: '2026-09-20', ends_on: '2026-09-30' }, T), 'upcoming');
  assert.equal(planSection({ kind: 'project', status: 'idea', starts_on: null }, T), 'ideas');
  assert.equal(planSection({ kind: 'goal', status: 'active', starts_on: '2026-01-01' }, T), 'goals');
  assert.equal(planSection({ kind: 'gathering', status: 'planned', starts_on: '2026-09-01' }, T), 'past');
  assert.equal(planSection({ kind: 'gathering', status: 'cancelled', starts_on: '2026-10-01' }, T), 'past');
});
