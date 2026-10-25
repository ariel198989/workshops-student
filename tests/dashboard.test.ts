import { test } from 'node:test';
import assert from 'node:assert/strict';
import { startOfLocalDayISO } from '../lib/dashboard-time.ts';

test('returns midnight of the local day as an ISO string', () => {
  const noon = new Date(2026, 9, 17, 12, 34, 56);
  const midnight = new Date(startOfLocalDayISO(noon));
  assert.equal(midnight.getFullYear(), 2026);
  assert.equal(midnight.getMonth(), 9);
  assert.equal(midnight.getDate(), 17);
  assert.equal(midnight.getHours(), 0);
  assert.equal(midnight.getMinutes(), 0);
  assert.equal(midnight.getSeconds(), 0);
});

test('does not mutate the input date', () => {
  const d = new Date(2026, 9, 17, 12, 0, 0);
  const before = d.getTime();
  startOfLocalDayISO(d);
  assert.equal(d.getTime(), before);
});
