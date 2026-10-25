import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';

// Same extensionless-import hook as ws-components.test.ts (the app uses bundler resolution).
const HOOK = `export async function resolve(spec, ctx, next) {
  try { return await next(spec, ctx); }
  catch (e) {
    if (e && e.code === 'ERR_MODULE_NOT_FOUND' && /^\\.\\.?\\//.test(spec)) return next(spec + '.ts', ctx);
    throw e;
  }
}`;
register('data:text/javascript,' + encodeURIComponent(HOOK), import.meta.url);

let U: typeof import('../components/ws/p3/workshop-utils.ts');
let E: typeof import('../components/ws/p3/db-errors.ts');

before(async () => {
  U = await import('../components/ws/p3/workshop-utils.ts');
  E = await import('../components/ws/p3/db-errors.ts');
});

// ── code ──────────────────────────────────────────────────────────────
test('normalizeCode uppercases, strips illegal chars and caps at 20', () => {
  assert.equal(U.normalizeCode('ofek e2e!'), 'OFEKE2E');
  assert.equal(U.normalizeCode('ab-12'), 'AB-12');
  assert.equal(U.normalizeCode('אופק'), '');
  assert.equal(U.normalizeCode('a'.repeat(30)).length, 20);
});

test('validateCode enforces ^[A-Z0-9][A-Z0-9-]{2,19}$', () => {
  assert.equal(U.validateCode('OFEK-2611'), null);
  assert.equal(U.validateCode('A1B'), null);
  assert.notEqual(U.validateCode('AB'), null);
  assert.notEqual(U.validateCode('-ABC'), null);
  assert.notEqual(U.validateCode('abc'), null);
  assert.notEqual(U.validateCode('A'.repeat(21)), null);
  assert.notEqual(U.validateCode(''), null);
});

test('suggestCode builds a valid code from org name and start date', () => {
  assert.equal(U.suggestCode('Ofek School', '2026-11-03'), 'OFEK-2611');
  assert.equal(U.suggestCode('אופק', '2026-11-03'), 'WS-2611');
  assert.equal(U.suggestCode('Ofek', ''), 'OFEK-NEW');
  assert.equal(U.suggestCode('', null), 'WS-NEW');
  for (const name of ['Ofek School', 'אופק', '', 'A', 'x'.repeat(40)]) {
    assert.equal(U.validateCode(U.suggestCode(name, '2027-01-09')), null, name);
  }
});

// ── team prefix ───────────────────────────────────────────────────────
test('validateTeamPrefix accepts a normal Hebrew prefix with gershayim', () => {
  assert.equal(U.validateTeamPrefix('אופק ח2 תשפ״ז'), null);
});

test('validateTeamPrefix rejects forbidden characters, each one', () => {
  for (const ch of [',', '(', ')', '"', "'", '\\']) {
    const msg = U.validateTeamPrefix(`אופק ${ch} ח`);
    assert.ok(msg && msg.includes(ch), `char ${ch}`);
  }
});

test('validateTeamPrefix rejects length, empty and the personal-team marker', () => {
  assert.notEqual(U.validateTeamPrefix(''), null);
  assert.notEqual(U.validateTeamPrefix('  '), null);
  assert.notEqual(U.validateTeamPrefix('א'), null);
  assert.equal(U.validateTeamPrefix('א'.repeat(24)), null);
  assert.notEqual(U.validateTeamPrefix('א'.repeat(25)), null);
  assert.notEqual(U.validateTeamPrefix('אישי ח'), null);
  assert.notEqual(U.validateTeamPrefix('אישיות'), null);
});

test('teamNamePreview matches the DB trigger format', () => {
  assert.equal(U.teamNamePreview('אופק ח2'), 'אופק ח2 · קבוצה 1');
  assert.equal(U.teamNamePreview('  אופק ', 3), 'אופק · קבוצה 3');
});

// ── template ──────────────────────────────────────────────────────────
test('pickDefaultTemplate prefers the default template of the chosen format', () => {
  const t = (id: string, format: string, is_default: boolean) => ({ id, format, is_default });
  const list = [t('a', 'sessions', false), t('b', 'sessions', true), t('c', 'custom', false), t('d', 'hackathon', true)];
  assert.equal(U.pickDefaultTemplate(list, 'sessions')?.id, 'b');
  assert.equal(U.pickDefaultTemplate(list, 'custom')?.id, 'c');
  assert.equal(U.pickDefaultTemplate(list, 'hackathon')?.id, 'd');
  assert.equal(U.pickDefaultTemplate([], 'sessions'), null);
  assert.equal(U.pickDefaultTemplate([t('x', 'custom', true)], 'sessions'), null);
});

// ── first session ─────────────────────────────────────────────────────
test('firstSessionIso returns an ISO instant at 16:00 local, or null', () => {
  assert.equal(U.firstSessionIso(''), null);
  assert.equal(U.firstSessionIso(null), null);
  assert.equal(U.firstSessionIso('not-a-date'), null);
  const iso = U.firstSessionIso('2026-11-03');
  assert.ok(iso);
  const d = new Date(iso);
  assert.equal(d.getHours(), 16);
  assert.equal(d.getDate(), 3);
});

// ── status actions ────────────────────────────────────────────────────
test('statusActions follows plan B and the DB transition table', () => {
  const to = (s: Parameters<typeof U.statusActions>[0], admin: boolean) =>
    U.statusActions(s, admin).map((a) => a.to);
  assert.deepEqual(to('draft', false), ['proposal', 'confirmed']);
  assert.deepEqual(to('draft', true), ['proposal', 'confirmed', 'cancelled']);
  assert.deepEqual(to('proposal', false), ['confirmed']);
  assert.deepEqual(to('confirmed', false), ['live']);
  assert.deepEqual(to('confirmed', true), ['live', 'cancelled']);
  assert.deepEqual(to('live', true), ['completed']);
  assert.deepEqual(to('completed', false), []);
  assert.deepEqual(to('completed', true), ['archived']);
  assert.deepEqual(to('cancelled', true), ['draft']);
  assert.deepEqual(to('cancelled', false), []);
  assert.deepEqual(to('archived', true), []);
});

test('going live and completing carry the required confirm texts', () => {
  const live = U.statusActions('confirmed', false).find((a) => a.to === 'live');
  assert.equal(live?.confirm, 'פתיחת הסדנה יוצרת את הקבוצות באפליקציית Smart City ומציגה אותן בהרשמה');
  const done = U.statusActions('live', false).find((a) => a.to === 'completed');
  assert.equal(done?.confirm, 'הקבוצות יוסתרו מההרשמה, הנתונים נשמרים');
});

// ── sorting ───────────────────────────────────────────────────────────
test('sortWorkshops orders live, confirmed, proposal, draft, completed, rest; newest first inside', () => {
  const w = (id: string, status: string, starts_on: string | null) => ({ id, status, starts_on });
  const rows = [
    w('arch', 'archived', '2026-01-01'), w('d1', 'draft', '2026-05-01'), w('live', 'live', '2026-03-01'),
    w('canc', 'cancelled', '2026-02-01'), w('c2', 'completed', '2026-02-01'), w('c1', 'completed', '2026-04-01'),
    w('conf', 'confirmed', null), w('prop', 'proposal', '2026-06-01'),
  ] as const;
  const ids = U.sortWorkshops(rows).map((r) => r.id);
  assert.deepEqual(ids, ['live', 'conf', 'prop', 'd1', 'c1', 'c2', 'canc', 'arch']);
  assert.deepEqual(rows.map((r) => r.id)[0], 'arch'); // input untouched
});

// ── db errors ─────────────────────────────────────────────────────────
test('dbErrorMessage maps unique violations to Hebrew', () => {
  const dup = (constraint: string) => ({
    code: '23505', message: `duplicate key value violates unique constraint "${constraint}"`,
  });
  assert.equal(E.dbErrorMessage(dup('ws_workshops_code_key')), 'הקוד כבר בשימוש');
  assert.equal(E.dbErrorMessage(dup('ws_workshops_team_prefix_key')), 'הקידומת כבר בשימוש');
  assert.equal(E.dbErrorMessage({ code: '23505', message: 'duplicate key' }), 'הערך כבר קיים');
  assert.match(E.dbErrorMessage(dup('ws_organizations_name_city_uq')), /ארגון/);
});

test('dbErrorMessage covers permission, missing account, lock and unknown errors', () => {
  assert.match(E.dbErrorMessage({ code: '42501', message: 'not authorized' }), /הרשאה/);
  assert.match(E.dbErrorMessage({ code: 'P0002', message: 'no account for x@y.z — send an invite first' }), /אין חשבון/);
  assert.match(E.dbErrorMessage({ code: '23514', message: 'team_prefix is locked once groups are activated' }), /נעול/);
  assert.equal(E.dbErrorMessage(new Error('boom secret detail')), 'הפעולה נכשלה');
  assert.equal(E.dbErrorMessage(null, 'נכשל'), 'נכשל');
  assert.equal(E.dbErrorMessage('weird'), 'הפעולה נכשלה');
});

test('fmtDay renders DD/MM/YYYY and empties bad input', () => {
  assert.equal(U.fmtDay('2026-11-03'), '03/11/2026');
  assert.equal(U.fmtDay('2026-11-03T10:00:00Z'), '03/11/2026');
  assert.equal(U.fmtDay(null), '');
  assert.equal(U.fmtDay('x'), '');
});
