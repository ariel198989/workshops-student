import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  classTier, coverageRows, overallTier, trainBlockReason, queueAhead, jobTone,
  RED_BELOW, STRONG_FROM, MIN_TRAIN_IMAGES, weakClasses, modelVerdict, accuracyPercent, waitLabel,
} from '../lib/cv/readiness.ts';

test('classTier uses 50 / 150 thresholds', () => {
  assert.equal(classTier(0), 'red');
  assert.equal(classTier(RED_BELOW - 1), 'red');
  assert.equal(classTier(RED_BELOW), 'ok');
  assert.equal(classTier(STRONG_FROM - 1), 'ok');
  assert.equal(classTier(STRONG_FROM), 'strong');
  assert.equal(classTier(Number.NaN), 'red');
});

test('coverageRows lists every target (zero when untouched) and appends off-target classes', () => {
  const rows = coverageRows(['כוס', 'מפתח'], [{ name: 'כוס', count: 60 }, { name: 'עט', count: 7 }]);
  assert.deepEqual(rows.map((r) => [r.name, r.count, r.tier, r.offTarget]), [
    ['כוס', 60, 'ok', false],
    ['מפתח', 0, 'red', false],
    ['עט', 7, 'red', true],
  ]);
  assert.equal(rows[1].missing, RED_BELOW);
  assert.equal(rows[0].missing, 0);
});

test('coverageRows with no targets falls back to what exists', () => {
  const rows = coverageRows([], [{ name: 'כוס', count: 160 }]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].tier, 'strong');
  assert.equal(rows[0].offTarget, false);
});

test('overallTier is the weakest class', () => {
  assert.equal(overallTier([]), 'red');
  assert.equal(overallTier(coverageRows(['a', 'b'], [{ name: 'a', count: 200 }, { name: 'b', count: 80 }])), 'ok');
  assert.equal(overallTier(coverageRows(['a', 'b'], [{ name: 'a', count: 200 }, { name: 'b', count: 150 }])), 'strong');
  assert.equal(overallTier(coverageRows(['a', 'b'], [{ name: 'a', count: 200 }])), 'red');
});

test('trainBlockReason explains why training is disabled', () => {
  assert.match(trainBlockReason(0, false) ?? '', /תויגו/);
  assert.match(trainBlockReason(MIN_TRAIN_IMAGES - 1, false) ?? '', new RegExp(String(MIN_TRAIN_IMAGES)));
  assert.match(trainBlockReason(40, true) ?? '', /ממתינה|רצה|בתור/);
  assert.equal(trainBlockReason(MIN_TRAIN_IMAGES, false), null);
});

const job = (id: string, status: string, at: string) => ({ id, status, created_at: at });

test('queueAhead counts only older pending jobs of anyone', () => {
  const all = [
    job('a', 'pending', '2026-10-18T10:00:00Z'),
    job('b', 'pending', '2026-10-18T10:05:00Z'),
    job('c', 'running', '2026-10-18T09:00:00Z'),
    job('d', 'pending', '2026-10-18T10:10:00Z'),
    job('e', 'done', '2026-10-18T08:00:00Z'),
  ];
  assert.equal(queueAhead(all, 'a'), 0);
  assert.equal(queueAhead(all, 'b'), 1);
  assert.equal(queueAhead(all, 'd'), 2);
  assert.equal(queueAhead(all, 'missing'), null);
  assert.equal(queueAhead(all, 'c'), null);
});

test('jobTone maps a job status to a UI tone', () => {
  assert.equal(jobTone('done'), 'ok');
  assert.equal(jobTone('running'), 'active');
  assert.equal(jobTone('pending'), 'wait');
  assert.equal(jobTone('cancelled'), 'off');
  assert.equal(jobTone('failed'), 'bad');
  assert.equal(jobTone('whatever'), 'off');
});

test('weakClasses flags low ap50 or few boxes, tolerating missing fields', () => {
  const weak = weakClasses([
    { name: 'a', ap50: 0.9, boxes: 100 },
    { name: 'b', ap50: 0.3, boxes: 100 },
    { name: 'c', ap50: null, boxes: 5 },
    { name: 'd' },
  ]);
  assert.deepEqual(weak.map((w) => w.name), ['b', 'c']);
});

test('weakClasses ignores non-array input from the database', () => {
  assert.deepEqual(weakClasses(null), []);
  assert.deepEqual(weakClasses('x'), []);
  assert.deepEqual(weakClasses([{ nope: 1 }, 7, null]), []);
});

test('modelVerdict is honest about small or unvalidated models', () => {
  assert.equal(modelVerdict(null, null), 'unknown');
  assert.equal(modelVerdict(20, true), 'weak');
  assert.equal(modelVerdict(200, false), 'weak');
  assert.equal(modelVerdict(60, true), 'basic');
  assert.equal(modelVerdict(150, true), 'strong');
});

test('accuracyPercent accepts 0..1 and percent values', () => {
  assert.equal(accuracyPercent(0.834), 83);
  assert.equal(accuracyPercent(83.4), 83);
  assert.equal(accuracyPercent(null), null);
});

test('waitLabel reads naturally in Hebrew', () => {
  assert.equal(waitLabel(20000), 'פחות מדקה');
  assert.equal(waitLabel(60000), 'דקה');
  assert.equal(waitLabel(12 * 60000), '12 דקות');
  assert.equal(waitLabel(60 * 60000), 'שעה');
  assert.equal(waitLabel(130 * 60000), '2 שעות ו-10 דקות');
});
