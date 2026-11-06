'use client';
// In-browser face detector for the privacy guard. BlazeFace (short range, ~460 KB) is self-hosted
// under public/models/blazeface; tfjs and the model load lazily, only on the screens that capture.
// Fail open: when the detector cannot load or run, the verdict is 'skipped' and a console warning
// tells the facilitator; a class is never blocked because a model failed. Decisions: ./face-guard.
import type { BlazeFaceModel } from '@tensorflow-models/blazeface';
import { decideFaces, GUARD_LOAD_TIMEOUT_MS, type FaceBoxLike, type GuardVerdict } from './face-guard';

export const BLAZEFACE_URL = '/models/blazeface/model.json';

export type FaceSource = HTMLCanvasElement | HTMLVideoElement | HTMLImageElement;

let model: BlazeFaceModel | null = null;
let loading: Promise<BlazeFaceModel | null> | null = null;
/** A failed load is not retried on every shot (each would wait for it); the next screen mount retries. */
let failed = false;
let warned = false;

function warnOnce(why: unknown): void {
  if (warned) return;
  warned = true;
  console.warn('[face-guard] face detector unavailable, photos are NOT checked for faces (fail open):', why);
}

async function load(): Promise<BlazeFaceModel | null> {
  try {
    const [tf, blazeface] = await Promise.all([import('@tensorflow/tfjs'), import('@tensorflow-models/blazeface')]);
    await tf.ready();
    // a low load threshold keeps candidates; face-guard.ts applies the real confidence bar
    model = await blazeface.load({ modelUrl: BLAZEFACE_URL, maxFaces: 5, scoreThreshold: 0.6 });
    return model;
  } catch (e) {
    failed = true;
    warnOnce(e);
    return null;
  } finally {
    loading = null;
  }
}

function ensureModel(): Promise<BlazeFaceModel | null> {
  if (model) return Promise.resolve(model);
  if (failed) return Promise.resolve(null);
  loading ??= load();
  return loading;
}

/** Start the download as a capture screen opens, so the first shot does not wait. Retries a failed load. */
export function preloadFaceGuard(): void {
  failed = false;
  void ensureModel();
}

const timeout = (ms: number) => new Promise<null>((res) => setTimeout(() => res(null), ms));

/** Faces in this frame, or null when the detector is unavailable (still loading after the timeout, failed to load, or threw). */
async function detect(src: FaceSource): Promise<readonly FaceBoxLike[] | null> {
  const m = await Promise.race([ensureModel(), timeout(GUARD_LOAD_TIMEOUT_MS)]);
  if (!m) { warnOnce(failed ? 'load failed' : `still loading after ${GUARD_LOAD_TIMEOUT_MS} ms`); return null; }
  try {
    // annotateBoxes=true: without it blazeface drops the probability; the frame is read before the first await
    return await m.estimateFaces(src, false, false, true);
  } catch (e) {
    console.warn('[face-guard] detection failed on this frame, not checked (fail open):', e);
    return null;
  }
}

const sizeOf = (src: FaceSource): { w: number; h: number } =>
  src instanceof HTMLVideoElement ? { w: src.videoWidth, h: src.videoHeight }
    : src instanceof HTMLImageElement ? { w: src.naturalWidth, h: src.naturalHeight }
      : { w: src.width, h: src.height };

/** 'face' means do not upload this frame; 'clear' and 'skipped' (fail open) let it through. */
export async function checkFrame(src: FaceSource): Promise<GuardVerdict> {
  const { w, h } = sizeOf(src);
  return decideFaces(await detect(src), w, h);
}
