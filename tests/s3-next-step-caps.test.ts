import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pickNextStep } from '../lib/student/next-step.ts';
import { capsForDepth } from '../lib/student/caps.ts';
import type { StudentProgress } from '../lib/student/context.ts';

const progress = (over: Partial<StudentProgress> = {}): StudentProgress => ({
  photos: 0, tagged: 0, untagged: 0, today: 0, contributors: 0,
  coverage: [], off_target_classes: [], readiness: 'no_targets',
  jobs: { pending: 0, running: 0, done: 0, last: null }, model: null, ...over,
});

const model = { id: 'm1', name: 'm', accuracy: 0.8, approved: false, image_count: 100, honest_val: true, class_stats: null, personal: false, created_at: '2026-10-01' };

const L0 = capsForDepth('L0');
const L1 = capsForDepth('L1');
const L2 = capsForDepth('L2');
const L3 = capsForDepth('L3');

test('default caps keep the L3 behaviour', () => {
  assert.equal(pickNextStep(progress({ photos: 5, untagged: 5 })).href, '/tag');
  assert.deepEqual(pickNextStep(progress({ photos: 5, untagged: 5 }), L3), pickNextStep(progress({ photos: 5, untagged: 5 })));
});

test('L0: students only watch the screen, never a cycle route', () => {
  for (const p of [null, progress(), progress({ photos: 80, untagged: 80 }), progress({ photos: 80, model })]) {
    const s = pickNextStep(p, L0);
    assert.equal(s.href, '/');
    assert.equal(s.title, 'המדריך מוביל את הפעילות');
  }
});

test('L1: capture first, keep capturing under 50 photos, then wait for the facilitator', () => {
  assert.equal(pickNextStep(null, L1).href, '/capture');
  const few = pickNextStep(progress({ photos: 20, untagged: 20 }), L1);
  assert.equal(few.href, '/capture');
  assert.doesNotMatch(few.title, /תייגו/);
  const enough = pickNextStep(progress({ photos: 50, untagged: 50 }), L1);
  assert.equal(enough.href, '/');
  assert.equal(enough.title, 'מחכים למדריך שיאמן');
});

test('L1: a running job or a finished model still means waiting, never /tag /train /results', () => {
  const running = pickNextStep(progress({ photos: 10, untagged: 10, jobs: { pending: 0, running: 1, done: 0, last: null } }), L1);
  assert.equal(running.href, '/');
  const done = pickNextStep(progress({ photos: 10, model }), L1);
  assert.equal(done.href, '/');
  assert.equal(done.title, 'מחכים למדריך שיאמן');
});

test('L2: tag first, then the facilitator submits the training', () => {
  assert.equal(pickNextStep(progress({ photos: 12, untagged: 7 }), L2).href, '/tag');
  const ready = pickNextStep(progress({ photos: 100, tagged: 100, coverage: [{ name: 'a', tagged: 60 }] }), L2);
  assert.equal(ready.href, '/');
  assert.equal(ready.title, 'המדריך מגיש לאימון');
});

test('L2: a running job points at results (students may view the model) and a model opens results', () => {
  const running = pickNextStep(progress({ photos: 100, tagged: 100, coverage: [{ name: 'a', tagged: 60 }],
    jobs: { pending: 0, running: 1, done: 0, last: null } }), L2);
  assert.equal(running.href, '/results');
  assert.notEqual(running.href, '/train');
  assert.equal(pickNextStep(progress({ photos: 100, tagged: 100, coverage: [{ name: 'a', tagged: 60 }], model }), L2).href, '/results');
});

test('L2: under 50 per class still sends the team to capture', () => {
  const s = pickNextStep(progress({ photos: 30, tagged: 30, coverage: [{ name: 'כוס', tagged: 30 }] }), L2);
  assert.equal(s.href, '/capture');
  assert.match(s.title, /כוס/);
});
