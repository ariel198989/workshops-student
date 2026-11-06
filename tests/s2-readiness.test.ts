import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  classTier, coverageRows, overallTier, trainBlockReason, queueAhead, jobTone, activeJobOf,
  RED_BELOW, STRONG_FROM, MIN_TRAIN_IMAGES, weakClasses, modelVerdict, accuracyPercent, waitLabel,
  jobAlert, canCancelJob, failedLabel, jobFailureReason, trainErrorHe, JOB_ALERT_HE, PENDING_STALE_MS, RUNNING_STUCK_MS,
} from '../lib/cv/readiness.ts';

const MIN = 60000;
const T0 = Date.parse('2026-10-31T10:00:00Z');
const at = (minutesAgo: number) => new Date(T0 - minutesAgo * MIN).toISOString();

test('jobAlert: a pending job older than 30 minutes with nothing running means the trainer is down', () => {
  const idle = [{ id: 'me', status: 'pending', created_at: at(31) }];
  assert.equal(jobAlert({ status: 'pending', created_at: at(31) }, idle, T0), 'trainer-idle');
  assert.equal(jobAlert({ status: 'pending', created_at: at(29) }, idle, T0), null, 'under 30 minutes is a normal wait');
  const busy = [...idle, { id: 'x', status: 'running', created_at: at(50) }];
  assert.equal(jobAlert({ status: 'pending', created_at: at(90) }, busy, T0), null, 'someone else is training: the queue is just long');
  assert.equal(PENDING_STALE_MS, 30 * MIN);
  assert.equal(JOB_ALERT_HE['trainer-idle'], 'המאמן לא פעיל כרגע. המדריך צריך להפעיל את האימון');
});

test('jobAlert: a running job older than 60 minutes is stuck, measured from started_at when present', () => {
  assert.equal(jobAlert({ status: 'running', created_at: at(61) }, [], T0), 'stuck');
  assert.equal(jobAlert({ status: 'running', created_at: at(59) }, [], T0), null);
  assert.equal(jobAlert({ status: 'running', created_at: at(200), started_at: at(10) }, [], T0), null, 'queued long, running briefly');
  assert.equal(jobAlert({ status: 'running', created_at: at(5), started_at: 'garbage' }, [], T0), null, 'bad started_at falls back');
  assert.equal(jobAlert({ status: 'done', created_at: at(500) }, [], T0), null);
  assert.equal(jobAlert({ status: 'failed', created_at: at(500) }, [], T0), null);
  assert.equal(RUNNING_STUCK_MS, 60 * MIN);
  assert.equal(JOB_ALERT_HE.stuck, 'האימון נתקע');
});

test('canCancelJob: the requester cancels pending always and running only when stuck', () => {
  assert.equal(canCancelJob({ status: 'pending' }, null, true), true);
  assert.equal(canCancelJob({ status: 'pending' }, 'trainer-idle', true), true);
  assert.equal(canCancelJob({ status: 'running' }, null, true), false);
  assert.equal(canCancelJob({ status: 'running' }, 'stuck', true), true);
  assert.equal(canCancelJob({ status: 'pending' }, null, false), false, 'not my job');
  assert.equal(canCancelJob({ status: 'done' }, null, true), false);
});

test('failed jobs render in Hebrew with the reason when there is one', () => {
  assert.equal(failedLabel(null), 'האימון נכשל');
  assert.equal(failedLabel('CUDA out of memory'), 'האימון נכשל: המאמן נגמר לו הזיכרון. המדריך צריך להפעיל אותו מחדש');
  assert.equal(failedLabel('לא נמצאו תמונות'), 'האימון נכשל: לא נמצאו תמונות');
  assert.equal(jobFailureReason({ error_message: ' boom ' }), 'boom');
  assert.equal(jobFailureReason({ error: 'x', error_message: '' }), 'x');
  assert.equal(jobFailureReason({ failure_reason: 'y' }), 'y');
  assert.equal(jobFailureReason({}), null);
});

test('trainErrorHe maps raw English errors to one Hebrew sentence and never leaks them', () => {
  assert.match(trainErrorHe('TypeError: Failed to fetch'), /אין חיבור/);
  assert.match(trainErrorHe('new row violates row-level security policy for table "ws_training_jobs"'), /הרשאה/);
  assert.match(trainErrorHe('duplicate key value violates unique constraint'), /כבר יש משימת/);
  assert.match(trainErrorHe('Payload too large'), /גדול מדי/);
  assert.match(trainErrorHe('The resource was not found in the bucket'), /העלאת הדאטה/);
  assert.match(trainErrorHe('canceling statement due to statement timeout'), /בזמן/);
  assert.equal(trainErrorHe('הודעה בעברית'), 'הודעה בעברית', 'our own copy passes through');
  const fallback = trainErrorHe('relation ws_x does not exist');
  assert.doesNotMatch(fallback, /relation|ws_x/);
  assert.match(fallback, /נסו שוב/);
  assert.equal(trainErrorHe('', 'ברירת מחדל'), 'ברירת מחדל');
  assert.equal(trainErrorHe(null, 'ברירת מחדל'), 'ברירת מחדל');
});

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

test('trainBlockReason in personal scope speaks about my own job and tags', () => {
  assert.match(trainBlockReason(40, true, true) ?? '', /יש לך/);
  assert.doesNotMatch(trainBlockReason(40, true, true) ?? '', /לקבוצה/);
  assert.match(trainBlockReason(0, false, true) ?? '', /תייגת/);
  assert.equal(trainBlockReason(MIN_TRAIN_IMAGES, false, true), null);
});

test('activeJobOf: any pending or running job blocks the group; in personal scope only mine does', () => {
  const jobs = [
    { id: 'done', status: 'done', requested_by: 'me' },
    { id: 'mate', status: 'running', requested_by: 'mate' },
    { id: 'mine', status: 'pending', requested_by: 'me' },
  ];
  assert.equal(activeJobOf(jobs, null)?.id, 'mate');
  assert.equal(activeJobOf(jobs, 'me')?.id, 'mine');
  assert.equal(activeJobOf(jobs.filter((j) => j.id !== 'mine'), 'me'), null, 'a teammate training does not block me');
  assert.equal(activeJobOf([], null), null);
});
