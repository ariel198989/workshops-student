import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  captureGate, createFaceGuard, fromSquare, GUARD_OFF_BANNER, GUARD_PREPARING, letterbox, prefetchesGuard,
  type FaceBoxLike, type FaceModelLike, type PreparedFrame,
} from '../lib/cv/face-guard.ts';

const tick = () => new Promise<void>((r) => setTimeout(r, 0));
const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

const model = (faces: FaceBoxLike[] | (() => never)): FaceModelLike => ({
  estimateFaces: async () => (typeof faces === 'function' ? faces() : faces),
});
/** A 1280x720 frame letterboxed onto the square, with a face of `side` px (original pixels) at (x, y). */
const frame = (): PreparedFrame => ({ input: {}, geom: letterbox(1280, 720), frameW: 1280, frameH: 720 });
const faceIn = (x: number, y: number, side: number, p = 0.95): FaceBoxLike => {
  const g = letterbox(1280, 720);
  return { topLeft: [x * g.scale + g.dx, y * g.scale + g.dy], bottomRight: [(x + side) * g.scale + g.dx, (y + side) * g.scale + g.dy], probability: [p] };
};

test('while the model loads every check is not-ready and the frame is never prepared', async () => {
  const g = createFaceGuard({ load: () => new Promise<FaceModelLike>(() => undefined), deadlineMs: 10_000 });
  g.start();
  let prepared = 0;
  assert.equal(g.status(), 'loading');
  assert.equal(await g.check(() => { prepared += 1; return frame(); }), 'not-ready');
  assert.equal(prepared, 0);
});

test('ready: a big face blocks, nothing is clear, a check that throws is an error (never an upload)', async () => {
  let faces: FaceBoxLike[] = [faceIn(300, 200, 300)];
  let boom = false;
  const g = createFaceGuard({
    load: async () => ({ estimateFaces: async () => { if (boom) throw new Error('webgl lost'); return faces; } }),
    deadlineMs: 10_000,
  });
  assert.equal(await g.settled(), 'ready');
  assert.equal(await g.check(frame), 'face');
  faces = [];
  assert.equal(await g.check(frame), 'clear');
  boom = true;
  assert.equal(await g.check(frame), 'error');
  assert.equal(await g.check(() => { throw new Error('no canvas'); }), 'error');
});

test('a rejected load is a hard failure: checks answer skipped at once, the facilitator is told once', async () => {
  const told: unknown[] = [];
  const g = createFaceGuard({ load: async () => { throw new Error('404'); }, deadlineMs: 10_000, onHardFail: (w) => told.push(w) });
  assert.equal(await g.settled(), 'failed');
  assert.equal(await g.check(frame), 'skipped');
  assert.equal(await g.check(frame), 'skipped');
  assert.equal(told.length, 1);
});

test('one shared deadline: a load that never resolves fails everybody at the same moment, and the timer is cleared', async () => {
  const timers: unknown[] = [];
  let cleared = 0;
  const g = createFaceGuard({
    load: () => new Promise<FaceModelLike>(() => undefined),
    deadlineMs: 30,
    setTimer: (fn, ms) => { const t = setTimeout(fn, ms); timers.push(t); return t; },
    clearTimer: (t) => { cleared += 1; clearTimeout(t as ReturnType<typeof setTimeout>); },
  });
  g.start();
  g.start();
  const a = g.settled();
  await wait(10);
  const b = g.settled(); // a later caller gets no fresh timeout of its own
  assert.equal(timers.length, 1);
  assert.deepEqual(await Promise.all([a, b]), ['failed', 'failed']);
  assert.equal(await g.check(frame), 'skipped');
  assert.equal(cleared, 0, 'a fired timer is not cleared twice');
});

test('a model that arrives in time clears the deadline timer', async () => {
  let cleared = 0;
  const g = createFaceGuard({
    load: async () => model([]),
    deadlineMs: 10_000,
    clearTimer: (t) => { cleared += 1; clearTimeout(t as ReturnType<typeof setTimeout>); },
  });
  assert.equal(await g.settled(), 'ready');
  assert.equal(cleared, 1);
});

test('a model that arrives after the deadline still turns the guard on', async () => {
  let resolve: (m: FaceModelLike) => void = () => undefined;
  const g = createFaceGuard({ load: () => new Promise<FaceModelLike>((r) => { resolve = r; }), deadlineMs: 5 });
  assert.equal(await g.settled(), 'failed');
  resolve(model([faceIn(300, 200, 300)]));
  await tick();
  assert.equal(g.status(), 'ready');
  assert.equal(await g.check(frame), 'face');
});

test('subscribers hear every state change', async () => {
  const seen: string[] = [];
  const g = createFaceGuard({ load: async () => model([]), deadlineMs: 10_000 });
  const off = g.subscribe((s) => seen.push(s));
  await g.settled();
  off();
  assert.deepEqual(seen, ['loading', 'ready']);
});

test('letterbox pads 16:9 onto the square without squashing and fromSquare maps boxes back', () => {
  const g = letterbox(1280, 720, 256);
  assert.equal(g.scale, 0.2);
  assert.equal(g.drawW, 256);
  assert.equal(g.drawH, 144);
  assert.equal(g.dx, 0);
  assert.equal(g.dy, 56);
  const back = fromSquare({ topLeft: [20, 76], bottomRight: [80, 136], probability: 0.9 }, g);
  assert.deepEqual(back.topLeft, [100, 100]);
  assert.deepEqual(back.bottomRight, [400, 400]);
  assert.equal(back.probability, 0.9);
  const tall = letterbox(720, 1280, 256);
  assert.equal(tall.dx, 56);
  assert.equal(tall.dy, 0);
});

test('the 3% rule is measured against the original frame, not the padded square', async () => {
  // 3.5% of the 1280x720 frame is only ~2% of the 256x256 square: it must still block
  const big = Math.ceil(Math.sqrt(0.035 * 1280 * 720));
  const small = Math.floor(Math.sqrt(0.025 * 1280 * 720));
  const g1 = createFaceGuard({ load: async () => model([faceIn(100, 100, big)]), deadlineMs: 10_000 });
  await g1.settled();
  assert.equal(await g1.check(frame), 'face');
  const g2 = createFaceGuard({ load: async () => model([faceIn(100, 100, small)]), deadlineMs: 10_000 });
  await g2.settled();
  assert.equal(await g2.check(frame), 'clear');
});

test('captureGate: buttons wait while loading, open with a banner after a hard failure', () => {
  assert.deepEqual(captureGate('idle'), { canShoot: false, banner: false, note: GUARD_PREPARING });
  assert.deepEqual(captureGate('loading'), { canShoot: false, banner: false, note: GUARD_PREPARING });
  assert.deepEqual(captureGate('ready'), { canShoot: true, banner: false, note: null });
  assert.deepEqual(captureGate('failed'), { canShoot: true, banner: true, note: null });
  assert.match(GUARD_OFF_BANNER, /בודק הפרטיות לא פעיל/);
});

test('prefetchesGuard: only when the next step is capture', () => {
  assert.equal(prefetchesGuard('/capture'), true);
  assert.equal(prefetchesGuard('/capture?cls=כוס'), true);
  assert.equal(prefetchesGuard('/captured'), false);
  assert.equal(prefetchesGuard('/tag'), false);
  assert.equal(prefetchesGuard(null), false);
});
