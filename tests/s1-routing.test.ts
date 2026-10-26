import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decideAccess, isPublicPath, STUDENT_HOME, STUDENT_JOIN } from '../lib/student/access.ts';
import type { Whoami } from '../lib/ws/types.ts';

const base = { user_id: 'u1', workshops: [] };
const staff: Whoami = { ...base, staff: { role: 'instructor', full_name: 'x' }, participations: [] };
const staffJoined: Whoami = {
  ...base, staff: { role: 'admin', full_name: 'x' },
  participations: [{ workshop_id: 'w1', participant_id: 'p1', group_id: 'g1' }],
};
const joined: Whoami = {
  ...base, staff: null,
  participations: [{ workshop_id: 'w1', participant_id: 'p1', group_id: 'g1' }],
};
const fresh: Whoami = { ...base, staff: null, participations: [] };

test('constants point at the root routes', () => {
  assert.equal(STUDENT_HOME, '/');
  assert.equal(STUDENT_JOIN, '/join');
});

test('whoami that failed to load is denied', () => {
  assert.deepEqual(decideAccess(null, '/', false), { kind: 'denied' });
});

test('public verify path is always public, even without whoami', () => {
  assert.deepEqual(decideAccess(null, '/verify/ABC', false), { kind: 'public' });
  assert.deepEqual(decideAccess(fresh, '/verify', false), { kind: 'public' });
  assert.equal(isPublicPath('/verifying'), false);
  assert.equal(isPublicPath('/facilitator'), true);
  assert.equal(isPublicPath('/facilitator/free'), true);
  assert.equal(isPublicPath(null), false);
});

test('staff without a participation sees the console notice until they choose to preview', () => {
  assert.deepEqual(decideAccess(staff, '/', false), { kind: 'staff-notice' });
  assert.deepEqual(decideAccess(staff, '/capture', false), { kind: 'staff-notice' });
  assert.deepEqual(decideAccess(staff, '/', true), { kind: 'student' });
  assert.deepEqual(decideAccess(staff, '/join', true), { kind: 'student' });
});

test('staff who are also students go straight into the student app', () => {
  assert.deepEqual(decideAccess(staffJoined, '/', false), { kind: 'student' });
});

test('a joined student stays on every student page, including /join', () => {
  for (const p of ['/', '/capture', '/tag', '/train', '/results', '/certificate', '/join']) {
    assert.deepEqual(decideAccess(joined, p, false), { kind: 'student' });
  }
  assert.deepEqual(decideAccess(joined, null, false), { kind: 'student' });
});

test('a student who has not joined is sent to /join', () => {
  assert.deepEqual(decideAccess(fresh, '/', false), { kind: 'redirect', to: '/join' });
  assert.deepEqual(decideAccess(fresh, '/capture', false), { kind: 'redirect', to: '/join' });
  assert.deepEqual(decideAccess(fresh, '/join', false), { kind: 'student' });
});
