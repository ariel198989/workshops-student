import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_CAPS, capsForDepth, isCaptureOnly, normalizeCaps } from '../lib/student/caps.ts';
import { decideRoute, gatedRouteOf, blockedReason } from '../lib/student/access.ts';
import { STUDENT_NAV, CHECK_NAV, studentNavFor } from '../lib/student/nav.ts';

test('a context without caps behaves as L3: full cycle, box tagging, model_score', () => {
  assert.deepEqual(normalizeCaps(undefined), DEFAULT_CAPS);
  assert.deepEqual(normalizeCaps(null), DEFAULT_CAPS);
  assert.deepEqual(normalizeCaps('junk'), DEFAULT_CAPS);
  assert.deepEqual(DEFAULT_CAPS, {
    can_capture: true, can_tag: true, tag_mode: 'box', can_train: true, can_view_model: true, metric_mode: 'model_score',
  });
});

test('missing caps but a known cycle_depth derives the server rules', () => {
  assert.equal(normalizeCaps(undefined, 'L0').can_capture, false);
  assert.equal(normalizeCaps(undefined, 'L1').metric_mode, 'x_of_10');
  assert.equal(normalizeCaps(undefined, 'L2').tag_mode, 'point');
  assert.equal(normalizeCaps(undefined, 'L4').metric_mode, 'map_pr');
  assert.deepEqual(capsForDepth('L9'), DEFAULT_CAPS);
});

test('server caps win, malformed fields fall back to the depth default', () => {
  const caps = normalizeCaps({ can_capture: true, can_tag: false, tag_mode: 'none', can_train: false,
    can_view_model: false, metric_mode: 'x_of_10' }, 'L1');
  assert.equal(caps.can_tag, false);
  assert.equal(caps.metric_mode, 'x_of_10');
  const partial = normalizeCaps({ can_capture: 'yes', metric_mode: 'percent' }, 'L2');
  assert.equal(partial.can_capture, true);
  assert.equal(partial.metric_mode, 'score_1_10');
});

test('can_tag and tag_mode are kept consistent', () => {
  assert.equal(normalizeCaps({ can_tag: true, tag_mode: 'none' }).can_tag, false);
  assert.equal(normalizeCaps({ can_tag: false, tag_mode: 'box' }).tag_mode, 'none');
});

test('isCaptureOnly is the L1 shape only', () => {
  assert.equal(isCaptureOnly(capsForDepth('L1')), true);
  assert.equal(isCaptureOnly(capsForDepth('L0')), false);
  assert.equal(isCaptureOnly(capsForDepth('L2')), false);
});

test('gatedRouteOf recognises the five gated roots and nothing else', () => {
  assert.equal(gatedRouteOf('/capture'), 'capture');
  assert.equal(gatedRouteOf('/tag/42'), 'tag');
  assert.equal(gatedRouteOf('/check'), 'check');
  assert.equal(gatedRouteOf('/'), null);
  assert.equal(gatedRouteOf('/certificate'), null);
  assert.equal(gatedRouteOf(null), null);
});

test('decideRoute: L3 opens every cycle route, /check only with checks', () => {
  for (const p of ['/', '/capture', '/tag', '/train', '/results', '/join']) {
    assert.deepEqual(decideRoute(p, DEFAULT_CAPS, 0), { allowed: true });
  }
  assert.equal(decideRoute('/check', DEFAULT_CAPS, 0).allowed, false);
  assert.equal(decideRoute('/check', DEFAULT_CAPS, 2).allowed, true);
});

test('decideRoute: L1 keeps capture and blocks tag/train/results with the gallery sentence', () => {
  const l1 = capsForDepth('L1');
  assert.deepEqual(decideRoute('/capture', l1, 0), { allowed: true });
  for (const p of ['/tag', '/train', '/results']) {
    const d = decideRoute(p, l1, 0);
    assert.equal(d.allowed, false);
    if (!d.allowed) {
      assert.equal(d.reason, 'התמונות שלכם עולות לגלריה של הקבוצה. המדריך מאמן את המודל ומראה את התוצאה על המסך.');
    }
  }
});

test('decideRoute: L2 blocks only train, L0 blocks everything gated', () => {
  const l2 = capsForDepth('L2');
  assert.equal(decideRoute('/tag', l2, 0).allowed, true);
  assert.equal(decideRoute('/results', l2, 0).allowed, true);
  assert.equal(decideRoute('/train', l2, 0).allowed, false);
  assert.match(blockedReason('train', l2), /המדריך/);
  const l0 = capsForDepth('L0');
  for (const p of ['/capture', '/tag', '/train', '/results']) assert.equal(decideRoute(p, l0, 0).allowed, false);
});

test('studentNavFor filters the cycle by caps and appends בדיקה only with checks', () => {
  assert.deepEqual(studentNavFor(DEFAULT_CAPS, 0), [...STUDENT_NAV]);
  assert.deepEqual(studentNavFor(DEFAULT_CAPS, 1).at(-1), CHECK_NAV);
  assert.deepEqual(studentNavFor(capsForDepth('L1'), 0).map((n) => n.id), ['home', 'capture']);
  assert.deepEqual(studentNavFor(capsForDepth('L2'), 0).map((n) => n.id), ['home', 'capture', 'tag', 'results']);
  assert.deepEqual(studentNavFor(capsForDepth('L0'), 3).map((n) => n.label), ['בית', 'בדיקה']);
  assert.equal(CHECK_NAV.href, '/check');
});
