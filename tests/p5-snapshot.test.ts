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

let S: typeof import('../components/ws/p5/snapshot.ts');
before(async () => {
  S = await import('../components/ws/p5/snapshot.ts');
});

test('readModelSnapshot extracts known fields and ignores wrong types', () => {
  const m = S.readModelSnapshot({
    name: 'דגם', accuracy: 0.734, image_count: 120, honest_val: true, approved: false,
    classes: ['a', 7, 'b'], created_at: '2026-10-01T00:00:00Z',
  });
  assert.deepEqual(m, {
    name: 'דגם', accuracyPct: 73, imageCount: 120, honestVal: true, approved: false,
    classes: ['a', 'b'], createdAt: '2026-10-01T00:00:00Z',
  });
});

test('readModelSnapshot returns null for a missing snapshot', () => {
  assert.equal(S.readModelSnapshot(null), null);
});

test('readDatasetSnapshot reads counts and coverage rows', () => {
  const d = S.readDatasetSnapshot({
    photos: 200, tagged: 150, contributors: 4, captured_at: '2026-10-02T00:00:00Z',
    coverage: [{ name: 'כלב', tagged: 80 }, { name: 5 }, 'x'],
  });
  assert.deepEqual(d, {
    photos: 200, tagged: 150, contributors: 4, capturedAt: '2026-10-02T00:00:00Z',
    coverage: [{ name: 'כלב', tagged: 80 }],
  });
});

test('readDatasetSnapshot defaults missing numbers to zero', () => {
  const d = S.readDatasetSnapshot({});
  assert.equal(d?.photos, 0);
  assert.deepEqual(d?.coverage, []);
  assert.equal(S.readDatasetSnapshot(null), null);
});

test('formatAccuracy renders a mAP fraction as percent text', () => {
  assert.equal(S.formatAccuracy(0.6), '60%');
  assert.equal(S.formatAccuracy(null), '-');
});
