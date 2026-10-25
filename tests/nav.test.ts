import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NAV_ITEMS, isActive } from '../lib/nav.ts';

test('root matches only the exact root path', () => {
  assert.equal(isActive('/', '/'), true);
  assert.equal(isActive('/workshops', '/'), false);
});

test('section matches itself and nested routes, not siblings', () => {
  assert.equal(isActive('/workshops', '/workshops'), true);
  assert.equal(isActive('/workshops/abc', '/workshops'), true);
  assert.equal(isActive('/workshops-old', '/workshops'), false);
  assert.equal(isActive('/orgs', '/workshops'), false);
});

test('null pathname never matches', () => {
  assert.equal(isActive(null, '/'), false);
});

test('nav has the 8 expected routes with unique hrefs and Hebrew labels', () => {
  assert.deepEqual(NAV_ITEMS.map((n) => n.href), [
    '/', '/workshops', '/orgs', '/curriculum', '/models', '/certificates', '/staff', '/settings',
  ]);
  assert.equal(new Set(NAV_ITEMS.map((n) => n.href)).size, NAV_ITEMS.length);
  for (const n of NAV_ITEMS) assert.match(n.label, /[֐-׿]/);
});
