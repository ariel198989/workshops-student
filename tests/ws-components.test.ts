import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';

// Same extensionless-import hook as ws-pure.test.ts (the app uses bundler resolution).
const HOOK = `export async function resolve(spec, ctx, next) {
  try { return await next(spec, ctx); }
  catch (e) {
    if (e && e.code === 'ERR_MODULE_NOT_FOUND' && /^\\.\\.?\\//.test(spec)) return next(spec + '.ts', ctx);
    throw e;
  }
}`;
register('data:text/javascript,' + encodeURIComponent(HOOK), import.meta.url);

let S: typeof import('../components/ws/sort.ts');
let I: typeof import('../components/ws/inline-utils.ts');
let F: typeof import('../components/ws/field-utils.ts');
let T: typeof import('../components/ws/target-classes.ts');
let W: typeof import('../lib/ws/workshops.ts');
let L: typeof import('../lib/ws/labels.ts');

before(async () => {
  S = await import('../components/ws/sort.ts');
  I = await import('../components/ws/inline-utils.ts');
  F = await import('../components/ws/field-utils.ts');
  T = await import('../components/ws/target-classes.ts');
  W = await import('../lib/ws/workshops.ts');
  L = await import('../lib/ws/labels.ts');
});

// ── sort ──────────────────────────────────────────────────────────────
test('compareValues orders numbers numerically, not lexically', () => {
  assert.ok(S.compareValues(2, 10) < 0);
  assert.ok(S.compareValues('קבוצה 2', 'קבוצה 10') < 0);
  assert.equal(S.compareValues('a', 'a'), 0);
});

test('sortRows is immutable, stable and keeps nulls last in both directions', () => {
  const rows = [
    { id: 'a', n: 3 }, { id: 'b', n: null }, { id: 'c', n: 1 }, { id: 'd', n: 3 },
  ] as const;
  const asc = S.sortRows(rows, (r) => r.n, 'asc').map((r) => r.id);
  const desc = S.sortRows(rows, (r) => r.n, 'desc').map((r) => r.id);
  assert.deepEqual(asc, ['c', 'a', 'd', 'b']);
  assert.deepEqual(desc, ['a', 'd', 'c', 'b']);
  assert.deepEqual(rows.map((r) => r.id), ['a', 'b', 'c', 'd']);
});

test('nextSort cycles asc, desc, none and resets on a new key', () => {
  const none = { key: null, dir: 'asc' } as const;
  const a1 = S.nextSort(none, 'name');
  assert.deepEqual(a1, { key: 'name', dir: 'asc' });
  const a2 = S.nextSort(a1, 'name');
  assert.deepEqual(a2, { key: 'name', dir: 'desc' });
  assert.deepEqual(S.nextSort(a2, 'name'), { key: null, dir: 'asc' });
  assert.deepEqual(S.nextSort(a2, 'city'), { key: 'city', dir: 'asc' });
});

// ── inline edit ───────────────────────────────────────────────────────
test('parseInlineValue: number, empty and text handling', () => {
  assert.deepEqual(I.parseInlineValue('number', ' 12.5 '), { ok: true, value: 12.5 });
  assert.deepEqual(I.parseInlineValue('number', ''), { ok: true, value: null });
  assert.equal(I.parseInlineValue('number', 'abc').ok, false);
  assert.deepEqual(I.parseInlineValue('text', '  שלום  '), { ok: true, value: 'שלום' });
  assert.deepEqual(I.parseInlineValue('text', '   '), { ok: true, value: null });
  assert.deepEqual(I.parseInlineValue('date', '2026-10-18'), { ok: true, value: '2026-10-18' });
});

test('datetime round trips between ISO and the datetime-local input value', () => {
  const iso = '2026-10-18T09:30:00.000Z';
  const local = I.toInputValue('datetime', iso);
  assert.match(local, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
  assert.deepEqual(I.parseInlineValue('datetime', local), { ok: true, value: iso });
  assert.equal(I.toInputValue('datetime', null), '');
  assert.equal(I.toInputValue('date', '2026-10-18T09:30:00Z'), '2026-10-18');
});

test('sameValue treats null and empty as equal', () => {
  assert.equal(I.sameValue(null, null), true);
  assert.equal(I.sameValue('a', 'a'), true);
  assert.equal(I.sameValue(1, '1'), false);
  assert.equal(I.sameValue(null, 'x'), false);
});

// ── custom fields ─────────────────────────────────────────────────────
const def = (over: Partial<import('../lib/ws/types.ts').WsFieldDefinition>) => ({
  id: 'f', entity: 'workshop', organization_id: null, key: 'k', label: 'שדה', field_type: 'text',
  options: [], required: false, position: 0, is_archived: false, created_at: '', ...over,
}) as import('../lib/ws/types.ts').WsFieldDefinition;

test('optionList accepts strings and {value,label} objects, skips junk', () => {
  assert.deepEqual(F.optionList(['א', { value: 'b', label: 'בי' }, { value: 'c' }, 5, null]), [
    { value: 'א', label: 'א' }, { value: 'b', label: 'בי' }, { value: 'c', label: 'c' },
  ]);
});

test('validateCustomFields reports required, number and url problems', () => {
  const defs = [
    def({ key: 'a', required: true }),
    def({ key: 'n', field_type: 'number' }),
    def({ key: 'u', field_type: 'url' }),
    def({ key: 'b', field_type: 'boolean', required: true }),
    def({ key: 'm', field_type: 'multiselect', required: true, options: ['x'] }),
  ];
  const errors = F.validateCustomFields(defs, { a: ' ', n: 'abc', u: 'not a url', b: false, m: [] });
  assert.deepEqual(Object.keys(errors).sort(), ['a', 'm', 'n', 'u']);
  const ok = F.validateCustomFields(defs, { a: 'x', n: 4, u: 'https://corewise.co.il', b: false, m: ['x'] });
  assert.deepEqual(ok, {});
});

test('every field_type has a renderer kind', () => {
  const types = ['text', 'number', 'date', 'boolean', 'select', 'multiselect', 'url'] as const;
  assert.equal(new Set(types.map((t) => F.FIELD_RENDERERS[t])).size > 0, true);
  for (const t of types) assert.ok(F.FIELD_RENDERERS[t], t);
});

test('setField is immutable and drops empty values', () => {
  const v = { a: 1 };
  const next = F.setField(v, 'b', 'x');
  assert.deepEqual(next, { a: 1, b: 'x' });
  assert.deepEqual(v, { a: 1 });
  assert.deepEqual(F.setField(next, 'b', ''), { a: 1 });
  assert.deepEqual(F.setField(next, 'b', []), { a: 1 });
  assert.deepEqual(F.setField({ f: true }, 'f', false), { f: false });
});

// ── target classes ────────────────────────────────────────────────────
test('addTargetClasses reuses normalizeTargetClasses (quotes, case dedupe, 40 chars)', () => {
  const out = T.addTargetClasses(['בקבוק'], ' "פקק", Bottle\nbottle, בקבוק ');
  assert.deepEqual(out, ['בקבוק', 'פקק', 'Bottle']);
  const long = T.addTargetClasses([], 'x'.repeat(60));
  assert.equal(long[0]?.length, W.MAX_CLASS_LEN);
  assert.deepEqual(T.addTargetClasses(['a'], '  ,, '), ['a']);
});

test('removeTargetClass is immutable and range safe', () => {
  const v = ['a', 'b', 'c'];
  assert.deepEqual(T.removeTargetClass(v, 1), ['a', 'c']);
  assert.deepEqual(v, ['a', 'b', 'c']);
  assert.deepEqual(T.removeTargetClass(v, 9), ['a', 'b', 'c']);
});

test('targetClassesHint matches the product guidance and flags over-use', () => {
  assert.equal(T.TARGET_CLASSES_HINT, '2-3 אובייקטים מומלץ');
  assert.equal(T.isOverRecommended(['a', 'b', 'c']), false);
  assert.equal(T.isOverRecommended(['a', 'b', 'c', 'd']), true);
});

// ── staff role pills ──────────────────────────────────────────────────
test('staff role pills cover every StaffRole with a valid tone and no em dash', () => {
  for (const role of ['owner', 'admin', 'instructor', 'guest'] as const) {
    const p = L.STAFF_ROLE_PILLS[role];
    assert.ok(p.label.length > 0);
    assert.ok(L.PILL_TONES.includes(p.tone));
    assert.ok(!p.label.includes('—'));
  }
});
