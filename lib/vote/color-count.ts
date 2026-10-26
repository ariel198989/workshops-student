// Classroom vote counted by the camera: every child holds up a GREEN or RED
// card, the frame is downscaled to <=160px, each pixel is classified by hue,
// and each connected blob of one colour counts as ONE card. Pure functions,
// no DOM, so Node can test it.

export type CardColour = 'green' | 'red';
export type PixelClass = CardColour | 'none';

export interface Hsv { readonly h: number; readonly s: number; readonly v: number }

export interface Thresholds {
  /** Minimum saturation 0..1; lower = more sensitive to faded cards. */
  readonly minSat: number;
  /** Minimum value (brightness) 0..1; lower = counts cards in a dim room. */
  readonly minVal: number;
  readonly greenHueMin: number;
  readonly greenHueMax: number;
  /** Red wraps around 0: hue <= redHueMax or hue >= redHueMin. */
  readonly redHueMax: number;
  readonly redHueMin: number;
}

export const DEFAULT_THRESHOLDS: Thresholds = {
  minSat: 0.45,
  minVal: 0.25,
  greenHueMin: 70,
  greenHueMax: 170,
  redHueMax: 15,
  redHueMin: 340,
};

/** Analysis works on a frame no wider than this; a card is a blob, not a pixel count. */
export const WORK_WIDTH = 160;
/** A blob must cover at least this fraction of the frame to count as one card. */
export const DEFAULT_MIN_AREA_FRACTION = 0.004;
/** Blobs thinner than this (bounding box side, px) are edges and lines, not cards. */
export const DEFAULT_MIN_SIDE = 6;
export const DEFAULT_SMOOTH_ALPHA = 0.5;
export const DEFAULT_STABLE_WINDOW = 5;

export const MASK_NONE = 0;
export const MASK_GREEN = 1;
export const MASK_RED = 2;

/** r,g,b 0..255 -> h 0..360, s 0..1, v 0..1 */
export function rgbToHsv(r: number, g: number, b: number): Hsv {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const d = max - min;
  const v = max;
  const s = max === 0 ? 0 : d / max;
  if (d === 0) return { h: 0, s, v };
  let h: number;
  if (max === rn) h = ((gn - bn) / d) % 6;
  else if (max === gn) h = (bn - rn) / d + 2;
  else h = (rn - gn) / d + 4;
  h *= 60;
  if (h < 0) h += 360;
  return { h, s, v };
}

export function classifyPixel(h: number, s: number, v: number, t: Thresholds = DEFAULT_THRESHOLDS): PixelClass {
  if (s < t.minSat || v < t.minVal) return 'none';
  if (h >= t.greenHueMin && h <= t.greenHueMax) return 'green';
  if (h <= t.redHueMax || h >= t.redHueMin) return 'red';
  return 'none';
}

/**
 * Sensitivity slider 0..1 -> thresholds. 0.5 is the default pair; sliding up
 * accepts paler and darker pixels, sliding down demands vivid, well-lit cards.
 */
export function thresholdsForSensitivity(level: number, base: Thresholds = DEFAULT_THRESHOLDS): Thresholds {
  const k = Math.min(1, Math.max(0, level)) - 0.5;
  return {
    ...base,
    minSat: clamp01(base.minSat - k * 0.4),
    minVal: clamp01(base.minVal - k * 0.3),
  };
}

const clamp01 = (x: number): number => Math.min(1, Math.max(0, x));

export interface ImageDataLike {
  readonly data: Uint8ClampedArray;
  readonly width: number;
  readonly height: number;
}

/** Nearest-neighbour downscale so the frame is at most `maxWidth` wide. Returns the input when already small. */
export function downscale(img: ImageDataLike, maxWidth = WORK_WIDTH): ImageDataLike {
  if (img.width <= maxWidth) return img;
  const w = maxWidth;
  const h = Math.max(1, Math.round((img.height * w) / img.width));
  const out = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    const sy = Math.min(img.height - 1, Math.floor((y * img.height) / h));
    for (let x = 0; x < w; x++) {
      const sx = Math.min(img.width - 1, Math.floor((x * img.width) / w));
      const si = (sy * img.width + sx) * 4;
      const di = (y * w + x) * 4;
      out[di] = img.data[si];
      out[di + 1] = img.data[si + 1];
      out[di + 2] = img.data[si + 2];
      out[di + 3] = 255;
    }
  }
  return { data: out, width: w, height: h };
}

/** One byte per pixel: MASK_NONE / MASK_GREEN / MASK_RED. */
export function buildMask(img: ImageDataLike, t: Thresholds = DEFAULT_THRESHOLDS): Uint8Array {
  const n = img.width * img.height;
  const mask = new Uint8Array(n);
  const d = img.data;
  for (let i = 0; i < n; i++) {
    const o = i * 4;
    const { h, s, v } = rgbToHsv(d[o], d[o + 1], d[o + 2]);
    const c = classifyPixel(h, s, v, t);
    mask[i] = c === 'green' ? MASK_GREEN : c === 'red' ? MASK_RED : MASK_NONE;
  }
  return mask;
}

export interface BlobCounts { readonly green: number; readonly red: number }

/**
 * 4-connected flood fill over the mask. A blob counts as one card when its
 * area is >= minArea AND its bounding box is at least minSide px on both
 * sides, so a thin green line (a shirt stripe, a window frame) is ignored.
 * The mask is not mutated; a separate visited buffer is used.
 */
export function countBlobs(mask: Uint8Array, w: number, h: number, minArea: number, minSide = DEFAULT_MIN_SIDE): BlobCounts {
  const visited = new Uint8Array(mask.length);
  let green = 0;
  let red = 0;
  for (let start = 0; start < mask.length; start++) {
    const colour = mask[start];
    if (colour === MASK_NONE || visited[start]) continue;
    const blob = fillFrom(mask, visited, start, w, h, colour);
    const wide = blob.maxX - blob.minX + 1 >= minSide && blob.maxY - blob.minY + 1 >= minSide;
    if (blob.area >= minArea && wide) {
      if (colour === MASK_GREEN) green++;
      else red++;
    }
  }
  return { green, red };
}

interface BlobBox { area: number; minX: number; maxX: number; minY: number; maxY: number }

/** Iterative 4-connected fill of one blob; marks `visited` (the only mutated buffer, owned by countBlobs). */
function fillFrom(mask: Uint8Array, visited: Uint8Array, start: number, w: number, h: number, colour: number): BlobBox {
  const stack: number[] = [start];
  visited[start] = 1;
  const box: BlobBox = { area: 0, minX: w, maxX: -1, minY: h, maxY: -1 };
  const push = (j: number): void => {
    if (!visited[j] && mask[j] === colour) { visited[j] = 1; stack.push(j); }
  };
  while (stack.length) {
    const i = stack.pop() as number;
    const x = i % w;
    const y = (i - x) / w;
    box.area++;
    if (x < box.minX) box.minX = x;
    if (x > box.maxX) box.maxX = x;
    if (y < box.minY) box.minY = y;
    if (y > box.maxY) box.maxY = y;
    if (x > 0) push(i - 1);
    if (x < w - 1) push(i + 1);
    if (y > 0) push(i - w);
    if (y < h - 1) push(i + w);
  }
  return box;
}

export interface AnalyzeOptions {
  readonly thresholds?: Thresholds;
  readonly maxWidth?: number;
  readonly minAreaFraction?: number;
  readonly minSide?: number;
}

export interface FrameAnalysis extends BlobCounts {
  /** Fraction (0..1) of frame pixels classified as each colour; for diagnostics, never shown to the class. */
  readonly greenPct: number;
  readonly redPct: number;
  /** The downscaled mask, so the UI can tint what the camera saw. */
  readonly mask: Uint8Array;
  readonly width: number;
  readonly height: number;
}

export function analyzeFrame(imageData: ImageDataLike, opts: AnalyzeOptions = {}): FrameAnalysis {
  const small = downscale(imageData, opts.maxWidth ?? WORK_WIDTH);
  const mask = buildMask(small, opts.thresholds ?? DEFAULT_THRESHOLDS);
  const total = small.width * small.height;
  const minArea = Math.max(1, Math.round(total * (opts.minAreaFraction ?? DEFAULT_MIN_AREA_FRACTION)));
  const counts = countBlobs(mask, small.width, small.height, minArea, opts.minSide ?? DEFAULT_MIN_SIDE);
  let gp = 0;
  let rp = 0;
  for (let i = 0; i < mask.length; i++) {
    if (mask[i] === MASK_GREEN) gp++;
    else if (mask[i] === MASK_RED) rp++;
  }
  return { ...counts, greenPct: total ? gp / total : 0, redPct: total ? rp / total : 0, mask, width: small.width, height: small.height };
}

/** Exponential smoothing so a displayed number glides instead of jumping. */
export function smoothCounts(prev: BlobCounts, next: BlobCounts, alpha = DEFAULT_SMOOTH_ALPHA): BlobCounts {
  const a = Math.min(1, Math.max(0, alpha));
  return { green: prev.green + (next.green - prev.green) * a, red: prev.red + (next.red - prev.red) * a };
}

/** Median of the last `window` samples; a one-frame glitch cannot change the count. */
export function stableCount(history: readonly number[], window = DEFAULT_STABLE_WINDOW): number {
  if (history.length === 0) return 0;
  const recent = history.slice(-Math.max(1, window));
  const sorted = [...recent].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/** Append a sample and keep only what the stabiliser needs. */
export function pushHistory(history: readonly number[], sample: number, window = DEFAULT_STABLE_WINDOW): number[] {
  return [...history, sample].slice(-Math.max(1, window));
}

/** Mask -> RGBA bytes for an overlay canvas: green and red tints, everything else transparent. */
export function maskToRgba(mask: Uint8Array): Uint8ClampedArray {
  const out = new Uint8ClampedArray(mask.length * 4);
  for (let i = 0; i < mask.length; i++) {
    const o = i * 4;
    if (mask[i] === MASK_GREEN) { out[o] = 34; out[o + 1] = 197; out[o + 2] = 94; out[o + 3] = 255; }
    else if (mask[i] === MASK_RED) { out[o] = 239; out[o + 1] = 68; out[o + 2] = 68; out[o + 3] = 255; }
  }
  return out;
}
