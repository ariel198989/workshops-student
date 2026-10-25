import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  readinessTier, barPercent, TICK_PERCENTS, formatAccuracy, tierLabel, RED_BELOW, STRONG_FROM,
} from '../components/ws/p4/readiness.ts';

test('readinessTier: red below 50, ok 50-149, strong from 150', () => {
  assert.equal(readinessTier(0), 'red');
  assert.equal(readinessTier(RED_BELOW - 1), 'red');
  assert.equal(readinessTier(RED_BELOW), 'ok');
  assert.equal(readinessTier(STRONG_FROM - 1), 'ok');
  assert.equal(readinessTier(STRONG_FROM), 'strong');
  assert.equal(readinessTier(5000), 'strong');
});

test('readinessTier: garbage input counts as red', () => {
  assert.equal(readinessTier(-3), 'red');
  assert.equal(readinessTier(Number.NaN), 'red');
});

test('barPercent: linear to 200 and clamped', () => {
  assert.equal(barPercent(0), 0);
  assert.equal(barPercent(100), 50);
  assert.equal(barPercent(200), 100);
  assert.equal(barPercent(999), 100);
  assert.equal(barPercent(-5), 0);
  assert.equal(barPercent(Number.NaN), 0);
});

test('ticks sit exactly on the tier thresholds', () => {
  assert.deepEqual(TICK_PERCENTS, [barPercent(RED_BELOW), barPercent(STRONG_FROM)]);
  assert.deepEqual(TICK_PERCENTS, [25, 75]);
});

test('formatAccuracy: mAP 0..1 becomes a percent, null stays null', () => {
  assert.equal(formatAccuracy(0.874), '87%');
  assert.equal(formatAccuracy(1), '100%');
  assert.equal(formatAccuracy(0), '0%');
  assert.equal(formatAccuracy(null), null);
});

test('formatAccuracy: values above 1 are already percents', () => {
  assert.equal(formatAccuracy(87.4), '87%');
});

test('tierLabel has Hebrew copy for every tier and no em dash', () => {
  for (const t of ['red', 'ok', 'strong'] as const) {
    assert.ok(tierLabel(t).length > 0);
    assert.ok(!tierLabel(t).includes('—'));
  }
});
