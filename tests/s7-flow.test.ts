import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  EMPTY_FLOW_PROGRESS, flowCta, flowHidden, flowNext, flowSteps, MIN_TRAIN_IMAGES, nextAfterCapture, photosLabel,
  readResultsSeen, resultsSeenKey, writeResultsSeen, type FlowProgress,
} from '../lib/student/flow.ts';
import { capsForDepth } from '../lib/student/caps.ts';
import { normalizeLive } from '../lib/student/live.ts';
import type { StorageLike } from '../lib/student/pending.ts';

const L1 = capsForDepth('L1');
const L2 = capsForDepth('L2');
const L3 = capsForDepth('L3');
const L0 = capsForDepth('L0');

const progress = (over: Partial<FlowProgress> = {}): FlowProgress => ({ ...EMPTY_FLOW_PROGRESS, ...over });
const ids = (caps = L3, p = progress(), live = null, path: string | null = '/') => flowSteps(caps, p, live, path).map((s) => s.id);

// ── after capture ──

test('nextAfterCapture: tagging workshops point at /tag, the button is secondary under the training floor', () => {
  const n = nextAfterCapture(L3, { total: MIN_TRAIN_IMAGES - 1 });
  assert.equal(n.href, '/tag');
  assert.equal(n.label, 'לשלב הבא: תיוג');
  assert.equal(n.ready, false);
  assert.equal(n.classReady, false);
});

test('nextAfterCapture: at the floor the button is ready and the toast says tagging', () => {
  const n = nextAfterCapture(L3, { total: MIN_TRAIN_IMAGES });
  assert.equal(n.ready, true);
  assert.match(n.readyToast, /לתיוג/);
});

test('nextAfterCapture: capture-only (L1) says we are done shooting and goes home', () => {
  const n = nextAfterCapture(L1, { total: 55 });
  assert.equal(n.href, '/');
  assert.equal(n.label, 'סיימנו לצלם');
  assert.equal(n.ready, true);
  assert.doesNotMatch(n.readyToast, /תיוג/);
});

test('nextAfterCapture: the per-object target (50) fires classReady', () => {
  assert.equal(nextAfterCapture(L3, { total: 60, active: 49 }).classReady, false);
  assert.equal(nextAfterCapture(L3, { total: 60, active: 50 }).classReady, true);
  assert.match(nextAfterCapture(L3, { total: 60, active: 50 }).classToast, /50/);
});

test('photosLabel counts in Hebrew, singular included', () => {
  assert.equal(photosLabel(1), 'צילמתם תמונה אחת');
  assert.equal(photosLabel(55), 'צילמתם 55 תמונות');
  assert.equal(nextAfterCapture(L3, { total: 55 }).countLabel, 'צילמתם 55 תמונות');
});

// ── stepper ──

test('L3 shows the four cycle steps in order; the certificate joins once issued', () => {
  assert.deepEqual(ids(), ['capture', 'tag', 'train', 'results']);
  assert.deepEqual(ids(L3, progress({ certificate: true })), ['capture', 'tag', 'train', 'results', 'certificate']);
});

test('caps trim the stepper: L2 has no train, L1 (one step) and L0 (none) show nothing', () => {
  assert.deepEqual(ids(L2), ['capture', 'tag', 'results']);
  assert.deepEqual(ids(L1), []);
  assert.deepEqual(ids(L0), []);
  // a certificate makes L1 a two-step path again
  assert.deepEqual(ids(L1, progress({ certificate: true })), ['capture', 'certificate']);
});

test('done ticks follow progress: photos > 0, tagged >= floor, model, results seen', () => {
  const none = flowSteps(L3, progress(), null, '/');
  assert.deepEqual(none.map((s) => s.done), [false, false, false, false]);
  const shot = flowSteps(L3, progress({ photos: 55, tagged: MIN_TRAIN_IMAGES - 1 }), null, '/');
  assert.deepEqual(shot.map((s) => s.done), [true, false, false, false]);
  const tagged = flowSteps(L3, progress({ photos: 55, tagged: MIN_TRAIN_IMAGES }), null, '/');
  assert.deepEqual(tagged.map((s) => s.done), [true, true, false, false]);
  const trained = flowSteps(L3, progress({ photos: 55, tagged: 55, model: true }), null, '/');
  assert.deepEqual(trained.map((s) => s.done), [true, true, true, false]);
  const seen = flowSteps(L3, progress({ photos: 55, tagged: 55, model: true, resultsSeen: true }), null, '/');
  assert.deepEqual(seen.map((s) => s.done), [true, true, true, true]);
  // results seen without a model is not a completed results step
  assert.equal(flowSteps(L3, progress({ resultsSeen: true }), null, '/')[3].done, false);
});

test('next is the first step not done; null when everything is done', () => {
  assert.equal(flowNext(flowSteps(L3, progress(), null, '/'))?.id, 'capture');
  assert.equal(flowNext(flowSteps(L3, progress({ photos: 55 }), null, '/'))?.id, 'tag');
  assert.equal(flowNext(flowSteps(L3, progress({ photos: 55, tagged: 55 }), null, '/'))?.id, 'train');
  assert.equal(flowNext(flowSteps(L3, progress({ photos: 55, tagged: 55, model: true }), null, '/'))?.id, 'results');
  assert.equal(flowNext(flowSteps(L3, progress({ photos: 55, tagged: 55, model: true, resultsSeen: true }), null, '/')), null);
  const withCert = flowSteps(L3, progress({ photos: 55, tagged: 55, model: true, resultsSeen: true, certificate: true }), null, '/');
  assert.equal(flowNext(withCert)?.id, 'certificate');
});

test('current follows the pathname, nested paths included', () => {
  const onTag = flowSteps(L3, progress(), null, '/tag/42');
  assert.deepEqual(onTag.map((s) => s.current), [false, true, false, false]);
  assert.deepEqual(flowSteps(L3, progress(), null, '/').map((s) => s.current), [false, false, false, false]);
});

test('the live lock dims steps the facilitator has not opened', () => {
  const live = normalizeLive({ step_key: 'tag', allowed_routes: ['tag'], updated_at: 'x' });
  assert.deepEqual(flowSteps(L3, progress(), live, '/tag').map((s) => s.open), [false, true, false, false]);
  assert.deepEqual(flowSteps(L3, progress(), null, '/tag').map((s) => s.open), [true, true, true, true]);
});

test('hidden on the public and facilitator paths', () => {
  for (const p of ['/facilitator', '/facilitator/abc', '/model/tok', '/g/tok', '/verify/1']) {
    assert.equal(flowHidden(p), true, p);
    assert.deepEqual(ids(L3, progress(), null, p), []);
  }
  for (const p of ['/', '/capture', '/tag', '/train', '/results', '/check', '/certificate', null]) {
    assert.equal(flowHidden(p), false, String(p));
  }
});

test('flowCta speaks in the stepper words: next step ahead, back to a done one, null off the path', () => {
  const steps = flowSteps(L3, progress({ photos: 55 }), null, '/');
  assert.equal(flowCta(steps, '/tag'), 'לשלב הבא: תיוג');
  assert.equal(flowCta(steps, '/train'), 'לשלב הבא: אימון');
  assert.equal(flowCta(steps, '/capture'), 'חזרה לצילום');
  assert.equal(flowCta(steps, '/'), null);
  assert.equal(flowCta(steps, '/check'), null);
  assert.equal(flowCta([], '/tag'), null);
});

// ── results seen ──

function memStorage(): StorageLike {
  const m = new Map<string, string>();
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => { m.set(k, v); }, removeItem: (k) => { m.delete(k); } };
}

test('results seen is per team and survives a blocked or missing storage', () => {
  const s = memStorage();
  assert.equal(readResultsSeen(s, 't1'), false);
  writeResultsSeen(s, 't1');
  assert.equal(readResultsSeen(s, 't1'), true);
  assert.equal(readResultsSeen(s, 't2'), false);
  assert.equal(resultsSeenKey('t1'), 'ws.resultsSeen.t1');
  assert.equal(readResultsSeen(null, 't1'), false);
  writeResultsSeen(null, 't1');
  const throwing: StorageLike = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); }, removeItem: () => undefined };
  assert.equal(readResultsSeen(throwing, 't1'), false);
  writeResultsSeen(throwing, 't1');
});
