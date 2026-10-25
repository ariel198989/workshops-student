import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';

const HOOK = `export async function resolve(spec, ctx, next) {
  try { return await next(spec, ctx); }
  catch (e) {
    if (e && e.code === 'ERR_MODULE_NOT_FOUND' && /^\\.\\.?\\//.test(spec)) return next(spec + '.ts', ctx);
    throw e;
  }
}`;
register('data:text/javascript,' + encodeURIComponent(HOOK), import.meta.url);

let F: typeof import('../components/ws/p3/form-utils.ts');
let S: typeof import('../components/ws/p3/staff-utils.ts');
let I: typeof import('../components/ws/p3/invite-utils.ts');
let D: typeof import('../components/ws/p3/fielddef-utils.ts');
let E: typeof import('../components/ws/p3/db-errors.ts');

before(async () => {
  F = await import('../components/ws/p3/form-utils.ts');
  S = await import('../components/ws/p3/staff-utils.ts');
  I = await import('../components/ws/p3/invite-utils.ts');
  D = await import('../components/ws/p3/fielddef-utils.ts');
  E = await import('../components/ws/p3/db-errors.ts');
});

// ── new workshop form ─────────────────────────────────────────────────
const GOOD = {
  orgId: 'o1', title: 'סדנת ראייה ממוחשבת', code: 'OFEK-2611', prefix: 'אופק ח2',
  startsOn: '2026-11-03', endsOn: '', audience: '36', groupSize: '4',
};

test('validateWorkshopForm passes a complete form', () => {
  assert.deepEqual(F.validateWorkshopForm(GOOD), {});
});

test('validateWorkshopForm reports each broken field under its key', () => {
  const errs = F.validateWorkshopForm({
    ...GOOD, orgId: '', title: ' a ', code: 'ab', prefix: 'אישי א', startsOn: '2026-11-10', endsOn: '2026-11-03',
    audience: '0', groupSize: '9',
  });
  assert.deepEqual(Object.keys(errs).sort(), ['audience', 'code', 'endsOn', 'groupSize', 'org', 'prefix', 'title']);
});

test('validateWorkshopForm: empty audience is fine, non-integers are not', () => {
  assert.deepEqual(F.validateWorkshopForm({ ...GOOD, audience: '' }), {});
  assert.ok(F.validateWorkshopForm({ ...GOOD, audience: '3.5' }).audience);
  assert.ok(F.validateWorkshopForm({ ...GOOD, audience: '501' }).audience);
  assert.ok(F.validateWorkshopForm({ ...GOOD, groupSize: '1' }).groupSize);
});

// ── staff policy ──────────────────────────────────────────────────────
test('staffPolicy: owner manages admin, instructor and guest rows', () => {
  const p = S.staffPolicy('owner', 'me', { user_id: 'u1', role: 'admin' });
  assert.equal(p.canChangeRole, true);
  assert.equal(p.canToggleActive, true);
  assert.deepEqual(p.roleOptions, ['admin', 'instructor', 'guest']);
});

test('staffPolicy: admin cannot set admin nor touch admin or owner rows', () => {
  const inst = S.staffPolicy('admin', 'me', { user_id: 'u1', role: 'instructor' });
  assert.deepEqual(inst.roleOptions, ['instructor', 'guest']);
  assert.equal(inst.canToggleActive, true);
  assert.equal(S.staffPolicy('admin', 'me', { user_id: 'u2', role: 'admin' }).canChangeRole, false);
  assert.equal(S.staffPolicy('admin', 'me', { user_id: 'u3', role: 'owner' }).canToggleActive, false);
});

test('staffPolicy: nobody edits themselves, non-admins edit nothing', () => {
  assert.equal(S.staffPolicy('owner', 'me', { user_id: 'me', role: 'owner' }).canChangeRole, false);
  assert.equal(S.staffPolicy('owner', 'me', { user_id: 'me', role: 'owner' }).canToggleActive, false);
  assert.equal(S.staffPolicy('instructor', 'me', { user_id: 'u1', role: 'guest' }).canChangeRole, false);
  assert.equal(S.staffPolicy(null, null, { user_id: 'u1', role: 'guest' }).canToggleActive, false);
});

// ── invite request ────────────────────────────────────────────────────
test('bearerToken extracts the JWT or returns null', () => {
  assert.equal(I.bearerToken('Bearer abc.def.ghi'), 'abc.def.ghi');
  assert.equal(I.bearerToken('bearer   x'), 'x');
  assert.equal(I.bearerToken('Basic abc'), null);
  assert.equal(I.bearerToken(null), null);
  assert.equal(I.bearerToken('Bearer '), null);
});

test('parseInviteBody validates email and role, normalizes input', () => {
  const ok = I.parseInviteBody({ email: '  Dana@Example.COM ', role: 'instructor', full_name: ' דנה ' });
  assert.deepEqual(ok, { ok: true, value: { email: 'dana@example.com', role: 'instructor', full_name: 'דנה' } });
  const noName = I.parseInviteBody({ email: 'a@b.co', role: 'guest' });
  assert.deepEqual(noName, { ok: true, value: { email: 'a@b.co', role: 'guest', full_name: undefined } });
});

test('parseInviteBody rejects owner, bad email and non-objects', () => {
  assert.equal(I.parseInviteBody({ email: 'a@b.co', role: 'owner' }).ok, false);
  assert.equal(I.parseInviteBody({ email: 'nope', role: 'admin' }).ok, false);
  assert.equal(I.parseInviteBody({ email: 'a@b.co' }).ok, false);
  assert.equal(I.parseInviteBody(null).ok, false);
  assert.equal(I.parseInviteBody('x').ok, false);
  assert.equal(I.parseInviteBody({ email: 'a@b.co', role: 'admin', full_name: 'x'.repeat(121) }).ok, false);
});

// ── field definitions ─────────────────────────────────────────────────
test('validateFieldKey mirrors ^[a-z][a-z0-9_]{1,39}$', () => {
  assert.equal(D.validateFieldKey('school_code'), null);
  assert.notEqual(D.validateFieldKey('1abc'), null);
  assert.notEqual(D.validateFieldKey('a'), null);
  assert.notEqual(D.validateFieldKey('Abc'), null);
  assert.notEqual(D.validateFieldKey('a-b'), null);
  assert.notEqual(D.validateFieldKey('a'.repeat(41)), null);
});

test('parseOptions splits on commas and newlines, trims, dedupes', () => {
  assert.deepEqual(D.parseOptions('א, ב\nג ,, א'), ['א', 'ב', 'ג']);
  assert.deepEqual(D.parseOptions('   '), []);
});

test('optionsToText round-trips strings and {value,label} objects', () => {
  assert.equal(D.optionsToText(['א', 'ב']), 'א, ב');
  assert.equal(D.optionsToText([{ value: 'x', label: 'X' }, 5, null]), 'x');
});

test('needsOptions is true only for select and multiselect', () => {
  assert.equal(D.needsOptions('select'), true);
  assert.equal(D.needsOptions('multiselect'), true);
  assert.equal(D.needsOptions('text'), false);
});

// ── friendly wrapper ──────────────────────────────────────────────────
test('withFriendlyError rethrows a Hebrew Error and passes values through', async () => {
  assert.equal(await E.withFriendlyError(async () => 5), 5);
  await assert.rejects(
    E.withFriendlyError(async () => { throw { code: '42501', message: 'x' }; }),
    (err: unknown) => err instanceof Error && /הרשאה/.test(err.message),
  );
});
