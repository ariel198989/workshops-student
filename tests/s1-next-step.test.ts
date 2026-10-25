import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  pickNextStep, classLevel, barFill, MIN_TAGGED, STRONG_TAGGED,
} from '../lib/student/next-step.ts';
import type { StudentProgress } from '../lib/student/context.ts';

const progress = (over: Partial<StudentProgress> = {}): StudentProgress => ({
  photos: 0, tagged: 0, untagged: 0, today: 0, contributors: 0,
  coverage: [], off_target_classes: [], readiness: 'no_targets',
  jobs: { pending: 0, running: 0, done: 0, last: null }, model: null, ...over,
});

const model = { id: 'm1', name: 'm', accuracy: 0.8, approved: false, image_count: 100, honest_val: true, class_stats: null, personal: false, created_at: '2026-10-01' };

test('thresholds are 50 and 150', () => {
  assert.equal(MIN_TAGGED, 50);
  assert.equal(STRONG_TAGGED, 150);
});

test('classLevel: red under 50, ok under 150, strong from 150', () => {
  assert.equal(classLevel(0), 'red');
  assert.equal(classLevel(49), 'red');
  assert.equal(classLevel(50), 'ok');
  assert.equal(classLevel(149), 'ok');
  assert.equal(classLevel(150), 'strong');
  assert.equal(classLevel(400), 'strong');
});

test('barFill is a 0..100 percent of the 150 scale', () => {
  assert.equal(barFill(0), 0);
  assert.equal(barFill(75), 50);
  assert.equal(barFill(150), 100);
  assert.equal(barFill(999), 100);
  assert.equal(barFill(-3), 0);
});

test('no progress at all: capture first object', () => {
  const s = pickNextStep(null);
  assert.equal(s.href, '/capture');
  assert.equal(s.title, 'צלמו את האובייקט הראשון');
});

test('zero photos: capture first object', () => {
  assert.equal(pickNextStep(progress()).href, '/capture');
});

test('untagged photos: tag them, with the count', () => {
  const s = pickNextStep(progress({ photos: 12, untagged: 7 }));
  assert.equal(s.href, '/tag');
  assert.equal(s.title, 'תייגו 7 תמונות');
});

test('one untagged photo uses the singular', () => {
  assert.equal(pickNextStep(progress({ photos: 1, untagged: 1 })).title, 'תייגו תמונה אחת');
});

test('every class at 50 and nothing running: train', () => {
  const p = progress({
    photos: 100, tagged: 100,
    coverage: [{ name: 'a', tagged: 50 }, { name: 'b', tagged: 80 }],
  });
  const s = pickNextStep(p);
  assert.equal(s.href, '/train');
  assert.equal(s.title, 'אמנו מודל');
});

test('running job: follow the training instead of starting one', () => {
  const p = progress({
    photos: 100, tagged: 100, coverage: [{ name: 'a', tagged: 90 }],
    jobs: { pending: 0, running: 1, done: 0, last: null },
  });
  const s = pickNextStep(p);
  assert.equal(s.href, '/train');
  assert.notEqual(s.title, 'אמנו מודל');
});

test('model exists: test the model', () => {
  const p = progress({
    photos: 100, tagged: 100, coverage: [{ name: 'a', tagged: 100 }], model,
  });
  const s = pickNextStep(p);
  assert.equal(s.href, '/results');
  assert.equal(s.title, 'בדקו את המודל');
});

test('untagged photos beat an existing model', () => {
  const p = progress({ photos: 100, untagged: 4, coverage: [{ name: 'a', tagged: 100 }], model });
  assert.equal(pickNextStep(p).href, '/tag');
});

test('a class under 50 sends the team back to capture, naming the weakest class', () => {
  const p = progress({
    photos: 60, tagged: 60,
    coverage: [{ name: 'כלב', tagged: 40 }, { name: 'חתול', tagged: 20 }],
  });
  const s = pickNextStep(p);
  assert.equal(s.href, '/capture');
  assert.match(s.title, /חתול/);
});

test('no target classes: train once total tagged reaches 50', () => {
  assert.equal(pickNextStep(progress({ photos: 60, tagged: 60 })).href, '/train');
  assert.equal(pickNextStep(progress({ photos: 30, tagged: 30 })).href, '/capture');
});
