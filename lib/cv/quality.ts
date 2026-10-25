// Instant on-device photo quality check before upload: garbage frames
// (dark, blurry) make a worse model, so they are dropped in ~30ms.
// Pixel math is pure (testable); the canvas wrapper lives in camera.ts.

export type QualityReason = 'dark' | 'blurry';
export interface FrameQuality { ok: boolean; reason: QualityReason | null }

const MIN_LUMINANCE = 28;
const MIN_SHARPNESS = 20;

export const QUALITY_MESSAGES: Record<QualityReason, string> = {
  dark: 'חשוך מדי. עברו למקום עם יותר אור.',
  blurry: 'התמונה מטושטשת. החזיקו את הטלפון יציב.',
};

/** RGBA pixels of a small copy (~160px wide). Laplacian variance measures sharpness. */
export function assessPixels(data: ArrayLike<number>, w: number, h: number): FrameQuality {
  const gray = new Float32Array(w * h);
  let lum = 0;
  for (let i = 0; i < w * h; i++) {
    const v = 0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2];
    gray[i] = v;
    lum += v;
  }
  if (lum / (w * h) < MIN_LUMINANCE) return { ok: false, reason: 'dark' };

  let sum = 0;
  let sum2 = 0;
  let n = 0;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const lap = 4 * gray[i] - gray[i - 1] - gray[i + 1] - gray[i - w] - gray[i + w];
      sum += lap;
      sum2 += lap * lap;
      n++;
    }
  }
  const variance = n ? sum2 / n - (sum / n) ** 2 : MIN_SHARPNESS;
  return variance < MIN_SHARPNESS ? { ok: false, reason: 'blurry' } : { ok: true, reason: null };
}
