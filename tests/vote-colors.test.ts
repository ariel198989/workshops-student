import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  analyzeFrame, buildMask, classifyPixel, countBlobs, DEFAULT_THRESHOLDS, downscale, MASK_GREEN, MASK_NONE, MASK_RED,
  maskToRgba, pushHistory, rgbToHsv, smoothCounts, stableCount, thresholdsForSensitivity, type ImageDataLike,
} from '../lib/vote/color-count.ts';

const W = 160;
const H = 120;

function blankFrame(w = W, h = H, fill: [number, number, number] = [250, 250, 245]): { data: Uint8ClampedArray; width: number; height: number } {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    data[i * 4] = fill[0]; data[i * 4 + 1] = fill[1]; data[i * 4 + 2] = fill[2]; data[i * 4 + 3] = 255;
  }
  return { data, width: w, height: h };
}

function paintRect(img: ImageDataLike, x0: number, y0: number, w: number, h: number, rgb: [number, number, number]): ImageDataLike {
  const data = new Uint8ClampedArray(img.data);
  for (let y = y0; y < y0 + h; y++) {
    for (let x = x0; x < x0 + w; x++) {
      const o = (y * img.width + x) * 4;
      data[o] = rgb[0]; data[o + 1] = rgb[1]; data[o + 2] = rgb[2]; data[o + 3] = 255;
    }
  }
  return { data, width: img.width, height: img.height };
}

const GREEN: [number, number, number] = [40, 180, 70];
const RED: [number, number, number] = [220, 40, 50];

test('hsv conversion of pure red, green, white and black', () => {
  const red = rgbToHsv(255, 0, 0);
  assert.equal(red.h, 0); assert.equal(red.s, 1); assert.equal(red.v, 1);
  const green = rgbToHsv(0, 255, 0);
  assert.equal(green.h, 120); assert.equal(green.s, 1); assert.equal(green.v, 1);
  const white = rgbToHsv(255, 255, 255);
  assert.equal(white.s, 0); assert.equal(white.v, 1);
  const black = rgbToHsv(0, 0, 0);
  assert.equal(black.s, 0); assert.equal(black.v, 0);
  const pinkRed = rgbToHsv(255, 0, 100);
  assert.ok(pinkRed.h > 330 && pinkRed.h < 345, `red wraps around 360 (got ${pinkRed.h})`);
});

test('pixel classes follow the hue windows and the s/v floors', () => {
  assert.equal(classifyPixel(120, 0.8, 0.8), 'green');
  assert.equal(classifyPixel(70, 0.8, 0.8), 'green');
  assert.equal(classifyPixel(170, 0.8, 0.8), 'green');
  assert.equal(classifyPixel(0, 0.8, 0.8), 'red');
  assert.equal(classifyPixel(15, 0.8, 0.8), 'red');
  assert.equal(classifyPixel(340, 0.8, 0.8), 'red');
  assert.equal(classifyPixel(350, 0.8, 0.8), 'red');
  assert.equal(classifyPixel(45, 0.8, 0.8), 'none', 'yellow is neither');
  assert.equal(classifyPixel(210, 0.8, 0.8), 'none', 'blue is neither');
  assert.equal(classifyPixel(120, 0.3, 0.8), 'none', 'washed out');
  assert.equal(classifyPixel(120, 0.8, 0.1), 'none', 'too dark');
  // white, black and grey never vote
  for (const [r, g, b] of [[255, 255, 255], [0, 0, 0], [128, 128, 128]] as const) {
    const { h, s, v } = rgbToHsv(r, g, b);
    assert.equal(classifyPixel(h, s, v), 'none');
  }
});

test('sensitivity slider: 0.5 is the default, up loosens, down tightens', () => {
  assert.deepEqual(thresholdsForSensitivity(0.5), DEFAULT_THRESHOLDS);
  const loose = thresholdsForSensitivity(1);
  const tight = thresholdsForSensitivity(0);
  assert.ok(loose.minSat < DEFAULT_THRESHOLDS.minSat && loose.minVal < DEFAULT_THRESHOLDS.minVal);
  assert.ok(tight.minSat > DEFAULT_THRESHOLDS.minSat && tight.minVal > DEFAULT_THRESHOLDS.minVal);
  assert.equal(thresholdsForSensitivity(7).minSat, loose.minSat, 'clamped');
  assert.equal(loose.greenHueMin, DEFAULT_THRESHOLDS.greenHueMin, 'hue windows untouched');
});

test('two green squares and one red square count as 2 green, 1 red', () => {
  let img = blankFrame();
  img = paintRect(img, 10, 10, 20, 20, GREEN);
  img = paintRect(img, 100, 60, 24, 24, GREEN);
  img = paintRect(img, 50, 80, 20, 20, RED);
  const r = analyzeFrame(img);
  assert.equal(r.green, 2);
  assert.equal(r.red, 1);
  assert.equal(r.width, W);
  assert.equal(r.height, H);
  assert.ok(r.greenPct > 0 && r.greenPct < 0.1);
  assert.ok(r.redPct > 0 && r.redPct < 0.05);
});

test('a thin green line below minArea or minSide is ignored', () => {
  // 2px x 60px = 120px: above the 0.4% area floor (77px) but thinner than 6px
  const thin = analyzeFrame(paintRect(blankFrame(), 20, 50, 60, 2, GREEN));
  assert.deepEqual({ green: thin.green, red: thin.red }, { green: 0, red: 0 });
  // 5x5 = 25px: below the area floor
  const tiny = analyzeFrame(paintRect(blankFrame(), 20, 50, 5, 5, GREEN));
  assert.equal(tiny.green, 0);
  // a 10x10 card right next to the line still counts once
  const both = analyzeFrame(paintRect(paintRect(blankFrame(), 20, 50, 60, 2, GREEN), 100, 20, 10, 10, GREEN));
  assert.equal(both.green, 1);
});

test('touching squares of different colours are separate blobs; same colour merges', () => {
  let img = blankFrame();
  img = paintRect(img, 10, 10, 20, 20, GREEN);
  img = paintRect(img, 30, 10, 20, 20, RED);
  let r = analyzeFrame(img);
  assert.deepEqual({ green: r.green, red: r.red }, { green: 1, red: 1 });
  img = paintRect(blankFrame(), 10, 10, 20, 20, GREEN);
  img = paintRect(img, 30, 10, 20, 20, GREEN);
  r = analyzeFrame(img);
  assert.equal(r.green, 1, 'two adjacent green cards held together read as one');
});

test('countBlobs works directly on a mask and does not mutate it', () => {
  const w = 10; const h = 10;
  const mask = new Uint8Array(w * h);
  for (let y = 0; y < 6; y++) for (let x = 0; x < 6; x++) mask[y * w + x] = MASK_RED;
  for (let y = 4; y < 10; y++) for (let x = 7; x < 10; x++) mask[y * w + x] = MASK_GREEN; // 3 wide, under minSide
  const before = Uint8Array.from(mask);
  assert.deepEqual(countBlobs(mask, w, h, 4), { green: 0, red: 1 });
  assert.deepEqual(countBlobs(mask, w, h, 4, 3), { green: 1, red: 1 });
  assert.deepEqual(mask, before);
});

test('buildMask marks each pixel class', () => {
  const img = paintRect(paintRect(blankFrame(4, 1), 0, 0, 1, 1, GREEN), 1, 0, 1, 1, RED);
  assert.deepEqual(Array.from(buildMask(img)), [MASK_GREEN, MASK_RED, MASK_NONE, MASK_NONE]);
  const rgba = maskToRgba(buildMask(img));
  assert.equal(rgba[3], 255, 'green tint opaque');
  assert.equal(rgba[7], 255, 'red tint opaque');
  assert.equal(rgba[11], 0, 'background transparent');
});

test('downscale caps the width and keeps the aspect ratio', () => {
  const big = paintRect(blankFrame(640, 480), 0, 0, 320, 480, GREEN);
  const small = downscale(big);
  assert.equal(small.width, 160);
  assert.equal(small.height, 120);
  assert.equal(downscale(small), small, 'already small frames pass through');
  const r = analyzeFrame(big);
  assert.equal(r.green, 1);
  assert.ok(Math.abs(r.greenPct - 0.5) < 0.02);
});

test('median stabiliser swallows a one-frame glitch', () => {
  assert.equal(stableCount([]), 0);
  assert.equal(stableCount([17, 17, 3, 17, 17]), 17);
  assert.equal(stableCount([17, 17, 25, 17, 18]), 17);
  assert.equal(stableCount([1, 2, 3, 4, 5, 6, 7], 3), 6, 'only the last window counts');
  assert.equal(stableCount([2, 4], 5), 3, 'even window averages the middle pair');
  const hist = pushHistory(pushHistory([1, 2, 3, 4, 5], 6), 7);
  assert.deepEqual(hist, [3, 4, 5, 6, 7]);
});

test('smoothCounts glides and never overshoots', () => {
  const s1 = smoothCounts({ green: 0, red: 0 }, { green: 10, red: 4 });
  assert.deepEqual(s1, { green: 5, red: 2 });
  const s2 = smoothCounts(s1, { green: 10, red: 4 }, 1);
  assert.deepEqual(s2, { green: 10, red: 4 });
  const s3 = smoothCounts(s1, { green: 10, red: 4 }, 0);
  assert.deepEqual(s3, s1);
});
