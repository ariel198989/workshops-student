import { test } from 'node:test';
import assert from 'node:assert/strict';
import { letterbox, rowsFromOutput, decodeYolo, iou, nms, type Box } from '../lib/cv/yolo.ts';

test('letterbox scales to fit and centers with padding', () => {
  const lb = letterbox(1280, 720, 640);
  assert.equal(lb.scale, 0.5);
  assert.equal(lb.nw, 640);
  assert.equal(lb.nh, 360);
  assert.equal(lb.padX, 0);
  assert.equal(lb.padY, 140);
});

test('rowsFromOutput transposes a channel-first [1, 4+nc, N] output into N rows', () => {
  // 2 classes -> 6 channels, 8 anchors (real models have N >> channels). Layout is channel-major.
  const n = 8;
  const data = new Float32Array(6 * n);
  for (let a = 0; a < n; a++) {
    data[0 * n + a] = 10 * a; // cx
    data[1 * n + a] = 10 * a + 1; // cy
    data[2 * n + a] = 10 * a + 2; // w
    data[3 * n + a] = 10 * a + 3; // h
    data[4 * n + a] = 0.5; // class 0
    data[5 * n + a] = 0.25; // class 1
  }
  const rows = rowsFromOutput(data, [1, 6, n]);
  assert.equal(rows.length, n);
  assert.deepEqual(rows[0], [0, 1, 2, 3, 0.5, 0.25]);
  assert.deepEqual(rows[7], [70, 71, 72, 73, 0.5, 0.25]);
});

test('rowsFromOutput keeps an already row-major [N, 4+nc] output as is', () => {
  const data = new Float32Array(6 * 5);
  for (let a = 0; a < 6; a++) data.set([a, a + 1, a + 2, a + 3, 0.5], a * 5);
  const rows = rowsFromOutput(data, [6, 5]);
  assert.equal(rows.length, 6);
  assert.deepEqual(rows[4], [4, 5, 6, 7, 0.5]);
});

test('decodeYolo maps a letterboxed detection back to normalized image coords', () => {
  const lb = letterbox(1280, 720, 640);
  const rows = [
    [320, 320, 100, 100, 0.05, 0.92], // strong class 1
    [10, 10, 5, 5, 0.01, 0.02], // noise
  ];
  const { boxes, top } = decodeYolo(rows, lb, 1280, 720, 0.25);
  assert.equal(boxes.length, 1);
  const b = boxes[0];
  assert.equal(b.cls, 1);
  assert.ok(Math.abs(b.score - 0.92) < 1e-9);
  assert.ok(Math.abs(b.x - 540 / 1280) < 1e-9);
  assert.ok(Math.abs(b.y - 260 / 720) < 1e-9);
  assert.ok(Math.abs(b.w - 200 / 1280) < 1e-9);
  assert.ok(Math.abs(b.h - 200 / 720) < 1e-9);
  assert.equal(top?.cls, 1);
});

test('decodeYolo with nothing above the threshold returns no boxes but still reports the best guess', () => {
  const lb = letterbox(640, 640, 640);
  const out = decodeYolo([[100, 100, 50, 50, 0.1, 0.12]], lb, 640, 640, 0.25);
  assert.equal(out.boxes.length, 0);
  assert.equal(out.lowGuess, true);
  assert.equal(out.top?.cls, 1);
});

test('iou of identical boxes is 1 and of disjoint boxes is 0', () => {
  const a: Box = { x: 0.1, y: 0.1, w: 0.2, h: 0.2, cls: 0, score: 1 };
  assert.ok(Math.abs(iou(a, a) - 1) < 1e-9);
  assert.equal(iou(a, { ...a, x: 0.7, y: 0.7 }), 0);
});

test('nms keeps the best of overlapping same-class boxes but not across classes', () => {
  const a: Box = { x: 0.1, y: 0.1, w: 0.3, h: 0.3, cls: 0, score: 0.9 };
  const dup: Box = { ...a, x: 0.11, score: 0.6 };
  const other: Box = { ...a, cls: 1, score: 0.5 };
  const kept = nms([dup, a, other], 0.45);
  assert.equal(kept.length, 2);
  assert.equal(kept[0].score, 0.9);
  assert.ok(kept.some((b) => b.cls === 1));
});
