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

let B: typeof import('../components/ws/p6/board.ts');

before(async () => {
  B = await import('../components/ws/p6/board.ts');
});

const row = (id: string, session_no: number, position: number, minutes = 60) =>
  ({ id, session_no, position, minutes });

const ITEMS = [row('c', 2, 3), row('a', 1, 1), row('b', 1, 2), row('d', 3, 4)];

// ── durations ─────────────────────────────────────────────────────────
test('effectiveMinutes prefers the template override', () => {
  assert.equal(B.effectiveMinutes({ duration_override: 30 }, { duration_minutes: 45 }), 30);
  assert.equal(B.effectiveMinutes({ duration_override: null }, { duration_minutes: 45 }), 45);
});

test('sessionTotals sums minutes per session number', () => {
  const totals = B.sessionTotals([row('a', 1, 1, 45), row('b', 1, 2, 30), row('c', 2, 3, 120)]);
  assert.deepEqual(totals, { 1: 75, 2: 120 });
});

test('sessionTarget is 120 for the sessions format and the template total otherwise', () => {
  assert.equal(B.sessionTarget('sessions', 700), 120);
  assert.equal(B.sessionTarget('hackathon', 390), 390);
  assert.equal(B.sessionTarget('custom', 240), 240);
});

test('balanceOf classifies under, exact and over', () => {
  assert.equal(B.balanceOf(90, 120), 'under');
  assert.equal(B.balanceOf(120, 120), 'ok');
  assert.equal(B.balanceOf(135, 120), 'over');
  assert.equal(B.balanceOf(0, 0), 'ok');
});

test('totalMinutes sums everything', () => {
  assert.equal(B.totalMinutes(ITEMS), 240);
  assert.equal(B.totalMinutes([]), 0);
});

// ── columns ───────────────────────────────────────────────────────────
test('buildColumns groups by session_no, orders by position and fills gaps', () => {
  const cols = B.buildColumns(ITEMS);
  assert.deepEqual(cols, [
    { session_no: 1, ids: ['a', 'b'] },
    { session_no: 2, ids: ['c'] },
    { session_no: 3, ids: ['d'] },
  ]);
  const gap = B.buildColumns([row('x', 1, 1), row('y', 3, 2)]);
  assert.deepEqual(gap.map((c) => c.session_no), [1, 2, 3]);
  assert.deepEqual(gap[1].ids, []);
});

test('buildColumns honours a minimum number of columns and handles no items', () => {
  assert.deepEqual(B.buildColumns([], 2).map((c) => c.session_no), [1, 2]);
  assert.deepEqual(B.buildColumns([], 0), []);
});

test('flattenIds returns the complete id list in column order', () => {
  assert.deepEqual(B.flattenIds(B.buildColumns(ITEMS)), ['a', 'b', 'c', 'd']);
});

// ── drag ──────────────────────────────────────────────────────────────
test('moveItem reorders inside a column (before a sibling)', () => {
  const next = B.moveItem(B.buildColumns(ITEMS), 'b', 1, 'a');
  assert.deepEqual(B.flattenIds(next), ['b', 'a', 'c', 'd']);
});

test('moveItem moving down inside a column inserts before the target, not after', () => {
  const cols = [{ session_no: 1, ids: ['a', 'b', 'c'] }];
  assert.deepEqual(B.moveItem(cols, 'a', 1, 'c')[0].ids, ['b', 'a', 'c']);
  assert.deepEqual(B.moveItem(cols, 'a', 1, null)[0].ids, ['b', 'c', 'a']);
});

test('moveItem across columns removes from the source and inserts in the destination', () => {
  const next = B.moveItem(B.buildColumns(ITEMS), 'a', 2, 'c');
  assert.deepEqual(next.map((c) => c.ids), [['b'], ['a', 'c'], ['d']]);
  assert.deepEqual(B.flattenIds(next), ['b', 'a', 'c', 'd']);
});

test('moveItem into an empty or missing column appends to it', () => {
  const next = B.moveItem(B.buildColumns(ITEMS), 'd', 4, null);
  assert.deepEqual(next.map((c) => c.session_no), [1, 2, 3, 4]);
  assert.deepEqual(next[3].ids, ['d']);
  assert.deepEqual(next[2].ids, []);
});

test('moveItem does not mutate its input and ignores unknown or self targets', () => {
  const cols = B.buildColumns(ITEMS);
  const snapshot = JSON.stringify(cols);
  B.moveItem(cols, 'a', 2, null);
  assert.equal(JSON.stringify(cols), snapshot);
  assert.deepEqual(B.moveItem(cols, 'zzz', 1, null), cols);
  assert.deepEqual(B.moveItem(cols, 'a', 1, 'a'), cols);
});

test('moveItem keeps the id set complete (no loss, no duplicates)', () => {
  const ids = (cols: ReturnType<typeof B.buildColumns>) => [...B.flattenIds(cols)].sort();
  const cols = B.buildColumns(ITEMS);
  for (const [id, to, before] of [['a', 3, 'd'], ['d', 1, 'b'], ['c', 1, null], ['b', 5, null]] as const) {
    assert.deepEqual(ids(B.moveItem(cols, id, to, before)), ids(cols));
  }
});

test('changedSession reports the new session_no only when the item changed column', () => {
  const before = B.buildColumns(ITEMS);
  const across = B.moveItem(before, 'a', 2, null);
  assert.equal(B.changedSession(before, across, 'a'), 2);
  const within = B.moveItem(before, 'b', 1, 'a');
  assert.equal(B.changedSession(before, within, 'b'), null);
});

test('dropBeforeId maps a hovered chip to the insert target', () => {
  assert.equal(B.dropBeforeId(['a', 'b', 'c'], 1, false), 'b');
  assert.equal(B.dropBeforeId(['a', 'b', 'c'], 1, true), 'c');
  assert.equal(B.dropBeforeId(['a', 'b', 'c'], 2, true), null);
});

test('templateStats counts distinct sessions and sums effective minutes per template', () => {
  const stats = B.templateStats([
    { template_id: 't1', session_no: 1, duration_override: null, module: { duration_minutes: 120 } },
    { template_id: 't1', session_no: 2, duration_override: 90, module: { duration_minutes: 120 } },
    { template_id: 't1', session_no: 2, duration_override: null, module: { duration_minutes: 15 } },
    { template_id: 't2', session_no: 1, duration_override: null, module: null },
  ]);
  assert.deepEqual(stats.t1, { sessions: 2, minutes: 225, modules: 3 });
  assert.deepEqual(stats.t2, { sessions: 1, minutes: 0, modules: 1 });
  assert.deepEqual(B.templateStats([]), {});
});
