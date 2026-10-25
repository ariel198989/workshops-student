import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  clamp01, pointToNormalized, boxFromPoints, isUsableBox, resizeBox, moveBox, hitTest, yoloLabelLine, containRect, MIN_BOX,
} from '../lib/cv/geometry.ts';

const rect = { left: 100, top: 50, width: 200, height: 100 };

test('clamp01 keeps values in 0..1 and survives NaN', () => {
  assert.equal(clamp01(-0.2), 0);
  assert.equal(clamp01(1.7), 1);
  assert.equal(clamp01(0.4), 0.4);
  assert.equal(clamp01(Number.NaN), 0);
});

test('pointToNormalized maps client coords into the stage and clamps outside touches', () => {
  assert.deepEqual(pointToNormalized(200, 100, rect), { x: 0.5, y: 0.5 });
  assert.deepEqual(pointToNormalized(0, 0, rect), { x: 0, y: 0 });
  assert.deepEqual(pointToNormalized(999, 999, rect), { x: 1, y: 1 });
});

test('pointToNormalized on a zero-size stage returns the origin instead of NaN', () => {
  assert.deepEqual(pointToNormalized(10, 10, { left: 0, top: 0, width: 0, height: 0 }), { x: 0, y: 0 });
});

test('boxFromPoints is order independent', () => {
  const a = { x: 0.2, y: 0.7 };
  const b = { x: 0.6, y: 0.3 };
  const box = boxFromPoints(a, b);
  assert.deepEqual(box, boxFromPoints(b, a));
  assert.equal(box.x, 0.2);
  assert.equal(box.y, 0.3);
  assert.ok(Math.abs(box.w - 0.4) < 1e-9);
  assert.ok(Math.abs(box.h - 0.4) < 1e-9);
});

test('isUsableBox rejects a smudge and accepts a real box', () => {
  assert.equal(isUsableBox({ x: 0.1, y: 0.1, w: MIN_BOX - 0.001, h: 0.3 }), false);
  assert.equal(isUsableBox({ x: 0.1, y: 0.1, w: 0.3, h: MIN_BOX - 0.001 }), false);
  assert.equal(isUsableBox({ x: 0.1, y: 0.1, w: 0.3, h: 0.2 }), true);
});

test('resizeBox keeps the opposite corner fixed', () => {
  const box = { x: 0.2, y: 0.2, w: 0.4, h: 0.4 };
  const r = resizeBox(box, 'se', { x: 0.9, y: 0.8 });
  assert.equal(r.x, 0.2);
  assert.equal(r.y, 0.2);
  assert.ok(Math.abs(r.w - 0.7) < 1e-9);
  assert.ok(Math.abs(r.h - 0.6) < 1e-9);
  const n = resizeBox(box, 'nw', { x: 0.1, y: 0.05 });
  assert.ok(Math.abs(n.x - 0.1) < 1e-9);
  assert.ok(Math.abs(n.w - 0.5) < 1e-9);
  assert.ok(Math.abs(n.h - 0.55) < 1e-9);
});

test('resizeBox can flip past the opposite corner without a negative size', () => {
  const r = resizeBox({ x: 0.4, y: 0.4, w: 0.2, h: 0.2 }, 'se', { x: 0.1, y: 0.1 });
  assert.ok(r.w >= 0 && r.h >= 0);
  assert.ok(Math.abs(r.x - 0.1) < 1e-9);
});

test('moveBox translates and never leaves the image', () => {
  const box = { x: 0.1, y: 0.1, w: 0.3, h: 0.3 };
  assert.deepEqual(moveBox(box, 0.2, 0.1), { x: 0.30000000000000004, y: 0.2, w: 0.3, h: 0.3 });
  const edge = moveBox(box, 5, 5);
  assert.ok(Math.abs(edge.x - 0.7) < 1e-9);
  assert.ok(Math.abs(edge.y - 0.7) < 1e-9);
  const back = moveBox(box, -5, -5);
  assert.equal(back.x, 0);
  assert.equal(back.y, 0);
});

test('hitTest finds corners first, then the inside, then nothing', () => {
  const box = { x: 0.2, y: 0.2, w: 0.4, h: 0.4 };
  assert.equal(hitTest(box, { x: 0.2, y: 0.2 }), 'nw');
  assert.equal(hitTest(box, { x: 0.6, y: 0.2 }), 'ne');
  assert.equal(hitTest(box, { x: 0.2, y: 0.6 }), 'sw');
  assert.equal(hitTest(box, { x: 0.61, y: 0.59 }), 'se');
  assert.equal(hitTest(box, { x: 0.4, y: 0.4 }), 'move');
  assert.equal(hitTest(box, { x: 0.95, y: 0.95 }), null);
});

test('yoloLabelLine writes class + normalized center box with 6 decimals', () => {
  assert.equal(
    yoloLabelLine(2, { x: 0.25, y: 0.5, w: 0.5, h: 0.25 }),
    '2 0.500000 0.625000 0.500000 0.250000',
  );
});

test('containRect letterboxes a landscape video inside a portrait phone screen', () => {
  const r = containRect(400, 800, 1280, 720);
  assert.equal(r.width, 400);
  assert.equal(Math.round(r.height), 225);
  assert.equal(r.left, 0);
  assert.equal(Math.round(r.top), 288);
});

test('containRect of an unknown video size fills the container', () => {
  assert.deepEqual(containRect(300, 500, 0, 0), { left: 0, top: 0, width: 300, height: 500 });
});
