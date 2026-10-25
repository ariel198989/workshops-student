import { test } from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';

// lib/ws/staff.ts uses extensionless relative imports (bundler resolution); retry them with .ts.
const HOOK = `export async function resolve(spec, ctx, next) {
  try { return await next(spec, ctx); }
  catch (e) {
    if (e && e.code === 'ERR_MODULE_NOT_FOUND' && /^\\.\\.?\\//.test(spec)) return next(spec + '.ts', ctx);
    throw e;
  }
}`;
register('data:text/javascript,' + encodeURIComponent(HOOK), import.meta.url);
import { decideRoute, roleLabel, isPublicPath, type Whoami } from '../lib/shell-access.ts';
import type { StaffRole } from '../lib/ws/types.ts';
import { visibleNavItems } from '../lib/nav.ts';

// Whoami is the canonical lib/ws/types shape (same one wsAuthStore holds).
const staff = (role: StaffRole): Whoami => ({
  user_id: 'u1', staff: { role, full_name: 'x' }, workshops: [], participations: [],
});

test('staff member gets the console', () => {
  assert.deepEqual(decideRoute(staff('instructor'), '/workshops'), { kind: 'staff' });
});

test('no staff and no participations goes to the student join flow, not the console', () => {
  const w: Whoami = { user_id: 'u', staff: null, workshops: [], participations: [] };
  assert.deepEqual(decideRoute(w, '/'), { kind: 'redirect', to: '/student/join' });
});

test('participant without staff row is kept out of the console', () => {
  const w: Whoami = { user_id: 'u', staff: null, workshops: [], participations: [{ workshop_id: 'w1', participant_id: 'p1', group_id: null }] };
  assert.deepEqual(decideRoute(w, '/workshops'), { kind: 'redirect', to: '/student' });
});

test('null whoami (rpc missing) is denied', () => {
  assert.deepEqual(decideRoute(null, '/'), { kind: 'denied' });
});

test('role labels are Hebrew', () => {
  assert.equal(roleLabel('owner'), 'בעלים');
  assert.equal(roleLabel('admin'), 'מנהל');
  assert.equal(roleLabel('instructor'), 'מדריך');
  assert.equal(roleLabel('guest'), 'אורח');
  assert.equal(roleLabel(null), '');
});

test('staff nav item only for owner and admin', () => {
  const has = (r: Parameters<typeof visibleNavItems>[0]) =>
    visibleNavItems(r).some((n) => n.href === '/staff');
  assert.equal(has('owner'), true);
  assert.equal(has('admin'), true);
  assert.equal(has('instructor'), false);
  assert.equal(has('guest'), false);
  assert.equal(has(null), false);
});

test('verify paths are public', () => {
  assert.equal(isPublicPath('/verify/ABC'), true);
  assert.equal(isPublicPath('/verify'), true);
  assert.equal(isPublicPath('/verifying'), false);
  assert.equal(isPublicPath('/workshops'), false);
  assert.equal(isPublicPath(null), false);
});

test('canonical staff helpers agree with the shell gate', async () => {
  const { isAdmin, isCoreStaff } = await import('../lib/ws/staff.ts');
  assert.equal(isAdmin(staff('admin')), true);
  assert.equal(isAdmin(staff('instructor')), false);
  assert.equal(isCoreStaff(staff('instructor')), true);
  assert.equal(isCoreStaff(staff('guest')), false);
  assert.equal(isAdmin({ user_id: 'u', staff: null, workshops: [], participations: [] }), false);
});
