import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  decideFaces, FACE_MESSAGE, faceArea, faceScore, galleryFaceNote, isBlockingFace, mayUpload, MIN_FACE_AREA, MIN_FACE_SCORE,
} from '../lib/cv/face-guard.ts';

const W = 1280;
const H = 720;
/** A square face box of `side` px at (x, y) with probability p, shaped like blazeface's output. */
const face = (x: number, y: number, side: number, p: unknown = [0.95]) => ({ topLeft: [x, y], bottomRight: [x + side, y + side], probability: p });

test('faceScore reads a number, a one-element array or a Float32Array; anything else is 0', () => {
  assert.equal(faceScore({ probability: 0.9 }), 0.9);
  assert.equal(faceScore({ probability: [0.7] }), 0.7);
  assert.ok(Math.abs(faceScore({ probability: new Float32Array([0.85]) }) - 0.85) < 1e-6);
  assert.equal(faceScore({}), 0);
  assert.equal(faceScore({ probability: 'high' }), 0);
  assert.equal(faceScore({ probability: [NaN] }), 0);
});

test('faceArea is the box share of the frame, clipped to the frame, 0 when malformed', () => {
  assert.equal(faceArea(face(0, 0, 640), 1280, 640), 0.5);
  // half the box hangs off the right edge: only the visible half counts
  assert.equal(faceArea(face(1180, 0, 200), W, H), (100 * 200) / (W * H));
  assert.equal(faceArea({ topLeft: [0, 0] }, W, H), 0);
  assert.equal(faceArea({ topLeft: 'x', bottomRight: [1, 1] }, W, H), 0);
  assert.equal(faceArea(face(0, 0, 100), 0, H), 0);
  // swapped corners still give a positive area
  assert.equal(faceArea({ topLeft: [100, 100], bottomRight: [0, 0] }, 1000, 1000), 0.01);
});

test('a confident face at least 3% of the frame blocks the upload', () => {
  const side = Math.ceil(Math.sqrt(MIN_FACE_AREA * W * H)); // just over 3%
  assert.equal(isBlockingFace(face(100, 100, side), W, H), true);
  assert.equal(decideFaces([face(100, 100, side)], W, H), 'face');
});

test('a small face (poster far away, passer-by) does not block', () => {
  const side = Math.floor(Math.sqrt(0.02 * W * H)); // 2% of the frame
  assert.equal(isBlockingFace(face(100, 100, side), W, H), false);
  assert.equal(decideFaces([face(100, 100, side)], W, H), 'clear');
});

test('a low-confidence box does not block, one just at the bar does', () => {
  assert.equal(decideFaces([face(0, 0, 400, [MIN_FACE_SCORE - 0.01])], W, H), 'clear');
  assert.equal(decideFaces([face(0, 0, 400, [MIN_FACE_SCORE])], W, H), 'face');
});

test('any one blocking face among several decides', () => {
  assert.equal(decideFaces([face(0, 0, 20), face(0, 0, 400, [0.5]), face(600, 200, 300)], W, H), 'face');
});

test('no faces is clear; a detector that did not run (null) is skipped and fails open', () => {
  assert.equal(decideFaces([], W, H), 'clear');
  assert.equal(decideFaces(null, W, H), 'skipped');
  assert.equal(mayUpload('clear'), true);
  assert.equal(mayUpload('skipped'), true);
  assert.equal(mayUpload('face'), false);
});

test('the student message is Hebrew, short and tells them what to do', () => {
  assert.match(FACE_MESSAGE, /[֐-׿]/);
  assert.ok(FACE_MESSAGE.length <= 60);
  assert.match(FACE_MESSAGE, /חפצים/);
});

test('galleryFaceNote: nothing for 0, singular for 1, a count otherwise', () => {
  assert.equal(galleryFaceNote(0), null);
  assert.equal(galleryFaceNote(NaN), null);
  assert.match(galleryFaceNote(1) ?? '', /^בתמונה אחת /);
  assert.match(galleryFaceNote(4) ?? '', /^ב-4 תמונות /);
});
