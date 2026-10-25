import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  captureFilename, validateClassName, fitWithin, coachTip, COACH_TIPS, createRetryQueue, mergeCounts, friendlyError,
} from '../lib/cv/capture-utils.ts';
import { assessPixels } from '../lib/cv/quality.ts';

test('captureFilename is ASCII, under pool/, and ws_ prefixed', () => {
  const p = captureFilename(1760000000000, 'ab12c');
  assert.equal(p, 'pool/ws_1760000000000_ab12c.jpg');
  assert.match(p, /^pool\/ws_\d+_[a-z0-9]+\.jpg$/);
});

test('validateClassName enforces the Smart City rules', () => {
  assert.deepEqual(validateClassName('  כוס  '), { ok: true, name: 'כוס' });
  assert.equal(validateClassName('').ok, false);
  assert.equal(validateClassName('a"b').ok, false);
  assert.equal(validateClassName("a'b").ok, false);
  assert.equal(validateClassName('a\nb').ok, false);
  assert.equal(validateClassName('x'.repeat(41)).ok, false);
  assert.equal(validateClassName('x'.repeat(40)).ok, true);
});

test('validateClassName normalizes the Hebrew construct form for "two"', () => {
  assert.deepEqual(validateClassName('שתיים אצבעות'), { ok: true, name: 'שתי אצבעות' });
});

test('fitWithin shrinks the long side to max and never upscales', () => {
  assert.deepEqual(fitWithin(2560, 1440, 1280), { w: 1280, h: 720 });
  assert.deepEqual(fitWithin(1080, 1920, 1280), { w: 720, h: 1280 });
  assert.deepEqual(fitWithin(640, 480, 1280), { w: 640, h: 480 });
});

test('coachTip rotates every few shots and wraps around', () => {
  assert.equal(coachTip(0), COACH_TIPS[0]);
  assert.equal(coachTip(4), COACH_TIPS[0]);
  assert.equal(coachTip(5), COACH_TIPS[1]);
  assert.equal(coachTip(5 * COACH_TIPS.length), COACH_TIPS[0]);
  assert.ok(COACH_TIPS.includes('זווית אחרת') && COACH_TIPS.includes('קרוב יותר'));
});

test('mergeCounts adds live shots on top of the server counts', () => {
  assert.deepEqual(mergeCounts({ a: 3 }, { a: 2, b: 1 }), { a: 5, b: 1 });
});

test('retry queue keeps failed items and delivers them on retry', async () => {
  let fail = true;
  const saved: string[] = [];
  const q = createRetryQueue<string>(async (item) => {
    if (fail) throw new Error('offline');
    saved.push(item);
  });
  q.submit('one');
  q.submit('two');
  await q.idle();
  assert.equal(q.stats().queued, 2);
  assert.equal(q.stats().failing, true);
  assert.equal(q.stats().saved, 0);
  fail = false;
  await q.retryNow();
  assert.deepEqual(saved, ['one', 'two']);
  assert.deepEqual(q.stats(), { queued: 0, saved: 2, failing: false, dropped: 0 });
});

test('retry queue refuses new items beyond its cap instead of eating memory', async () => {
  const q = createRetryQueue<number>(async () => { throw new Error('offline'); }, { max: 3 });
  const accepted = [1, 2, 3, 4, 5].map((n) => q.submit(n));
  await q.idle();
  assert.deepEqual(accepted, [true, true, true, false, false]);
  assert.equal(q.stats().dropped, 2);
  assert.equal(q.stats().queued, 3);
});

test('retry queue reports changes to a listener', async () => {
  const seen: number[] = [];
  const q = createRetryQueue<number>(async () => undefined, { onChange: (s) => seen.push(s.saved) });
  q.submit(1);
  await q.idle();
  assert.equal(seen[seen.length - 1], 1);
});

function frame(w: number, h: number, fill: (x: number, y: number) => number): Uint8ClampedArray {
  const d = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const v = fill(x, y);
    const i = (y * w + x) * 4;
    d[i] = v; d[i + 1] = v; d[i + 2] = v; d[i + 3] = 255;
  }
  return d;
}

test('assessPixels rejects dark and flat frames, accepts a detailed one', () => {
  assert.equal(assessPixels(frame(32, 32, () => 5), 32, 32).ok, false);
  const flat = assessPixels(frame(32, 32, () => 128), 32, 32);
  assert.equal(flat.ok, false);
  assert.equal(flat.reason, 'blurry');
  const checker = assessPixels(frame(32, 32, (x, y) => ((x + y) % 2 ? 220 : 40)), 32, 32);
  assert.equal(checker.ok, true);
});

test('friendlyError shows our Hebrew messages and hides raw technical ones', () => {
  assert.equal(friendlyError(new Error('אין הרשאה')), 'אין הרשאה');
  assert.equal(friendlyError(new Error('JWT expired')), 'משהו השתבש. נסו שוב בעוד רגע');
  assert.equal(friendlyError('boom', 'ברירת מחדל'), 'ברירת מחדל');
});
