// זום פיקסלים: pure maths for the live "ציור במספרים" experience.
// A camera frame is boxed down to N columns (aspect kept), every box becomes
// one flat colour, and the brightness of each box is bucketed into a digit
// 0..9 so the class can see "the computer gets a list of numbers".
// No DOM here; the component feeds it ImageData-shaped objects.

export const LEVELS: readonly number[] = [8, 16, 32, 64, 128];
export const FULL = 'full';
export type PixelLevel = number | typeof FULL;

/** Digits stay readable on a projector only up to this many columns. */
export const DIGITS_MAX_COLS = 16;

/** Anything with RGBA bytes, width and height: ImageData or a plain object in tests. */
export type RgbaImage = { width: number; height: number; data: ArrayLike<number> };

/** The downsampled picture: `cells` holds r,g,b per cell, row-major. */
export type Grid = { cols: number; rows: number; cells: Uint8ClampedArray };

const LAST = LEVELS[LEVELS.length - 1];

/** 8 → 16 → … → 128 → full; full stays full. Off-list values snap to the next larger level. */
export function nextLevel(level: PixelLevel): PixelLevel {
  if (level === FULL) return FULL;
  const larger = LEVELS.find((l) => l > level);
  return larger === undefined ? FULL : larger;
}

/** full → 128 → … → 8; 8 stays 8. Off-list values snap to the next smaller level. */
export function prevLevel(level: PixelLevel): PixelLevel {
  if (level === FULL) return LAST;
  const smaller = LEVELS.filter((l) => l < level);
  return smaller.length ? smaller[smaller.length - 1] : LEVELS[0];
}

export const canShowDigits = (level: PixelLevel): boolean => level !== FULL && level <= DIGITS_MAX_COLS;

/** Rows that keep the source aspect for a given column count, never below 1. */
export function rowsFor(width: number, height: number, cols: number): number {
  if (width <= 0 || height <= 0) return 1;
  return Math.max(1, Math.round((height * cols) / width));
}

/** Box-average the image into `cols` columns; rows follow the aspect ratio. */
export function downsample(img: RgbaImage, cols: number): Grid {
  const w = Math.max(0, Math.floor(img.width));
  const h = Math.max(0, Math.floor(img.height));
  const c = Math.max(1, Math.min(Math.floor(cols), Math.max(1, w)));
  const r = Math.min(rowsFor(w, h, c), Math.max(1, h));
  const cells = new Uint8ClampedArray(c * r * 3);
  if (w === 0 || h === 0) return { cols: c, rows: r, cells };

  const { data } = img;
  for (let row = 0; row < r; row++) {
    const y0 = Math.floor((row * h) / r);
    const y1 = Math.max(y0 + 1, Math.floor(((row + 1) * h) / r));
    for (let col = 0; col < c; col++) {
      const x0 = Math.floor((col * w) / c);
      const x1 = Math.max(x0 + 1, Math.floor(((col + 1) * w) / c));
      let sr = 0; let sg = 0; let sb = 0;
      for (let y = y0; y < y1; y++) {
        let i = (y * w + x0) * 4;
        for (let x = x0; x < x1; x++, i += 4) {
          sr += data[i]; sg += data[i + 1]; sb += data[i + 2];
        }
      }
      const n = (y1 - y0) * (x1 - x0);
      const o = (row * c + col) * 3;
      cells[o] = sr / n; cells[o + 1] = sg / n; cells[o + 2] = sb / n;
    }
  }
  return { cols: c, rows: r, cells };
}

/** Perceived brightness 0..255 (Rec. 601 weights). */
export const luminance = (r: number, g: number, b: number): number => 0.299 * r + 0.587 * g + 0.114 * b;

/** One digit per cell: 0 = black … 9 = white, equal 25.6-wide buckets. */
export function toBrightnessDigits(cells: ArrayLike<number>): number[] {
  const out: number[] = [];
  for (let i = 0; i + 2 < cells.length; i += 3) {
    // rounding first keeps grey 128 at exactly 5 (the weights sum to 0.999…)
    out.push(Math.min(9, Math.floor(Math.round(luminance(cells[i], cells[i + 1], cells[i + 2])) / 25.6)));
  }
  return out;
}

/** Same cells with r=g=b=luminance; a new array, the input is untouched. */
export function toGray(cells: ArrayLike<number>): Uint8ClampedArray {
  const out = new Uint8ClampedArray(cells.length);
  for (let i = 0; i + 2 < cells.length; i += 3) {
    const l = luminance(cells[i], cells[i + 1], cells[i + 2]);
    out[i] = l; out[i + 1] = l; out[i + 2] = l;
  }
  return out;
}

/** rgb triplets → rgba bytes with full alpha, ready for an ImageData buffer. */
export function toRgba(cells: ArrayLike<number>): Uint8ClampedArray {
  const n = Math.floor(cells.length / 3);
  const out = new Uint8ClampedArray(n * 4);
  for (let i = 0; i < n; i++) {
    out[i * 4] = cells[i * 3]; out[i * 4 + 1] = cells[i * 3 + 1]; out[i * 4 + 2] = cells[i * 3 + 2]; out[i * 4 + 3] = 255;
  }
  return out;
}

/** Digits laid out as rows, the way they are read aloud. */
export function digitRows(digits: readonly number[], cols: number): number[][] {
  const c = Math.max(1, cols);
  return Array.from({ length: Math.ceil(digits.length / c) }, (_, r) => digits.slice(r * c, (r + 1) * c));
}

const group = (n: number): string => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

/** "8 × 6 = 48 ריבועים" — the counter under the canvas; never a percentage. */
export const cellCountLabel = (cols: number, rows: number): string => `${cols} × ${rows} = ${group(cols * rows)} ריבועים`;

/** "התמונה המלאה: 1,280 × 720 = 921,600 ריבועים" */
export const fullCountLabel = (width: number, height: number): string =>
  `התמונה המלאה: ${group(width)} × ${group(height)} = ${group(width * height)} ריבועים`;
