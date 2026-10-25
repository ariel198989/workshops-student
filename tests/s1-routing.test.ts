import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decideRoute, isStudentPath, type Whoami } from '../lib/shell-access.ts';

const base = { user_id: 'u1', workshops: [] };
const staff: Whoami = { ...base, staff: { role: 'instructor', full_name: 'x' }, participations: [] };
const joined: Whoami = {
  ...base, staff: null,
  participations: [{ workshop_id: 'w1', participant_id: 'p1', group_id: 'g1' }],
};
const fresh: Whoami = { ...base, staff: null, participations: [] };

test('whoami that failed to load is denied', () => {
  assert.deepEqual(decideRoute(null, '/student'), { kind: 'denied' });
});

test('public verify path is always public, even without whoami', () => {
  assert.deepEqual(decideRoute(null, '/verify/ABC'), { kind: 'public' });
  assert.deepEqual(decideRoute(fresh, '/verify'), { kind: 'public' });
});

test('staff sees the console on console paths', () => {
  assert.deepEqual(decideRoute(staff, '/'), { kind: 'staff' });
  assert.deepEqual(decideRoute(staff, '/workshops/abc'), { kind: 'staff' });
});

test('staff may preview student pages without redirect', () => {
  assert.deepEqual(decideRoute(staff, '/student'), { kind: 'student' });
  assert.deepEqual(decideRoute(staff, '/student/capture'), { kind: 'student' });
});

test('participant without staff row never reaches the console', () => {
  assert.deepEqual(decideRoute(joined, '/'), { kind: 'redirect', to: '/student' });
  assert.deepEqual(decideRoute(joined, '/workshops'), { kind: 'redirect', to: '/student' });
  assert.deepEqual(decideRoute(joined, '/staff'), { kind: 'redirect', to: '/student' });
});

test('joined student stays on student pages', () => {
  assert.deepEqual(decideRoute(joined, '/student'), { kind: 'student' });
  assert.deepEqual(decideRoute(joined, '/student/train'), { kind: 'student' });
  assert.deepEqual(decideRoute(joined, '/student/certificate'), { kind: 'student' });
});

test('student with no participation is sent to the join page', () => {
  assert.deepEqual(decideRoute(fresh, '/'), { kind: 'redirect', to: '/student/join' });
  assert.deepEqual(decideRoute(fresh, '/student'), { kind: 'redirect', to: '/student/join' });
  assert.deepEqual(decideRoute(fresh, '/student/capture'), { kind: 'redirect', to: '/student/join' });
});

test('student with no participation may stay on the join page', () => {
  assert.deepEqual(decideRoute(fresh, '/student/join'), { kind: 'student' });
});

test('joined student may open the join page (joining another group is handled by the RPC)', () => {
  assert.deepEqual(decideRoute(joined, '/student/join'), { kind: 'student' });
});

test('null pathname is treated as the root', () => {
  assert.deepEqual(decideRoute(joined, null), { kind: 'redirect', to: '/student' });
});

test('isStudentPath matches the segment, not a prefix of another word', () => {
  assert.equal(isStudentPath('/student'), true);
  assert.equal(isStudentPath('/student/tag'), true);
  assert.equal(isStudentPath('/students'), false);
  assert.equal(isStudentPath('/'), false);
  assert.equal(isStudentPath(null), false);
});
