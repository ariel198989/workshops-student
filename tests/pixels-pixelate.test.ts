import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  canShowDigits, cellCountLabel, digitRows, downsample, FULL, fullCountLabel, LEVELS, nextLevel, prevLevel,
  rowsFor, toBrightnessDigits, toGray, toRgba,
} from '../lib/pixels/pixelate.ts';

/** Build an RGBA image from a function of (x, y) → [r, g, b]. */
function image(width: number, height: number, px: (x: number, y: number) => [number, number, number]) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const [r, g, b] = px(x, y);
      const i = (y * width + x) * 4;
      data[i] = r; data[i + 1] = g; data[i + 2] = b; data[i + 3] = 255;
    }
  }
  return { width, height, data };
}

test('4×4 checkerboard boxes down to 2×2 mid-grey averages', () => {
  const board = image(4, 4, (x, y) => ((x + y) % 2 ? [255, 255, 255] : [0, 0, 0]));
  const g = downsample(board, 2);
  assert.equal(g.cols, 2);
  assert.equal(g.rows, 2);
  assert.equal(g.cells.length, 2 * 2 * 3);
  for (const v of g.cells) assert.ok(v === 127 || v === 128, `each box averages two black and two white: got ${v}`);
});

test('4×4 of four solid quadrants gives exact 2×2 colours', () => {
  const quads = image(4, 4, (x, y) => {
    if (y < 2) return x < 2 ? [255, 0, 0] : [0, 255, 0];
    return x < 2 ? [0, 0, 255] : [255, 255, 255];
  });
  const g = downsample(quads, 2);
  assert.deepEqual(Array.from(g.cells), [255, 0, 0, 0, 255, 0, 0, 0, 255, 255, 255, 255]);
});

test('rows follow the aspect ratio and never drop below one', () => {
  assert.equal(rowsFor(128, 96, 8), 6);
  assert.equal(rowsFor(128, 72, 16), 9);
  assert.equal(rowsFor(100, 1, 8), 1);
  const wide = image(8, 4, () => [10, 20, 30]);
  const g = downsample(wide, 4);
  assert.equal(g.rows, 2);
  assert.deepEqual(Array.from(g.cells.slice(0, 3)), [10, 20, 30]);
  const tiny = downsample(image(2, 2, () => [1, 2, 3]), 8);
  assert.equal(tiny.cols, 2, 'cannot have more columns than source pixels');
});

test('brightness digits: black 0, white 9, mid grey 5', () => {
  assert.deepEqual(toBrightnessDigits([0, 0, 0, 255, 255, 255, 128, 128, 128]), [0, 9, 5]);
  assert.deepEqual(toBrightnessDigits([255, 0, 0]), [2], 'pure red is dark-ish');
  assert.deepEqual(toBrightnessDigits([0, 255, 0]), [5], 'pure green is mid');
  assert.deepEqual(toBrightnessDigits([]), []);
  for (const d of toBrightnessDigits([25, 25, 25, 26, 26, 26, 230, 230, 230])) assert.ok(d >= 0 && d <= 9);
});

test('gray keeps luminance and does not mutate the input', () => {
  const cells = new Uint8ClampedArray([255, 0, 0, 0, 0, 0, 255, 255, 255]);
  const gray = toGray(cells);
  assert.deepEqual(Array.from(gray), [76, 76, 76, 0, 0, 0, 255, 255, 255]);
  assert.deepEqual(Array.from(cells), [255, 0, 0, 0, 0, 0, 255, 255, 255]);
  assert.deepEqual(toBrightnessDigits(gray), toBrightnessDigits(cells), 'digits are the same in colour and gray');
});

test('rgba expansion adds a solid alpha', () => {
  assert.deepEqual(Array.from(toRgba([1, 2, 3, 4, 5, 6])), [1, 2, 3, 255, 4, 5, 6, 255]);
});

test('level stepping walks the list and clamps at both ends', () => {
  assert.deepEqual([...LEVELS], [8, 16, 32, 64, 128]);
  assert.equal(nextLevel(8), 16);
  assert.equal(nextLevel(64), 128);
  assert.equal(nextLevel(128), FULL);
  assert.equal(nextLevel(FULL), FULL);
  assert.equal(nextLevel(10), 16, 'off-list snaps up');
  assert.equal(prevLevel(FULL), 128);
  assert.equal(prevLevel(16), 8);
  assert.equal(prevLevel(8), 8);
  assert.equal(prevLevel(10), 8, 'off-list snaps down');
});

test('digits only at 8 and 16', () => {
  assert.equal(canShowDigits(8), true);
  assert.equal(canShowDigits(16), true);
  assert.equal(canShowDigits(32), false);
  assert.equal(canShowDigits(FULL), false);
});

test('digit rows and counter labels', () => {
  assert.deepEqual(digitRows([1, 2, 3, 4, 5, 6], 3), [[1, 2, 3], [4, 5, 6]]);
  assert.deepEqual(digitRows([], 8), []);
  assert.equal(cellCountLabel(8, 8), '8 × 8 = 64 ריבועים');
  assert.equal(cellCountLabel(128, 96), '128 × 96 = 12,288 ריבועים');
  assert.equal(fullCountLabel(1280, 720), 'התמונה המלאה: 1,280 × 720 = 921,600 ריבועים');
  assert.doesNotMatch(cellCountLabel(16, 12), /%/);
});
