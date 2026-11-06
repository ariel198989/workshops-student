'use client';
// In-browser face detector for the privacy guard. BlazeFace (short range, ~460 KB) is self-hosted under
// public/models/blazeface; tfjs and the model load lazily (capture route, or home when capture is next).
// The lifecycle (one load, one shared 20 s deadline, hard failure = fail open with a banner) is the pure
// createFaceGuard in ./face-guard; this file only binds it to blazeface and the canvas.
import { useSyncExternalStore } from 'react';
import type { BlazeFaceModel } from '@tensorflow-models/blazeface';
import { createFaceGuard, letterbox, type GuardStatus, type GuardVerdict, type PreparedFrame } from './face-guard';

export const BLAZEFACE_URL = '/models/blazeface/model.json';

export type FaceSource = HTMLCanvasElement | HTMLVideoElement | HTMLImageElement | ImageBitmap;

async function loadBlazeface(): Promise<BlazeFaceModel> {
  const [tf, blazeface] = await Promise.all([import('@tensorflow/tfjs'), import('@tensorflow-models/blazeface')]);
  await tf.ready();
  // a low load threshold keeps candidates; face-guard.ts applies the real confidence bar
  return blazeface.load({ modelUrl: BLAZEFACE_URL, maxFaces: 5, scoreThreshold: 0.6 });
}

const guard = createFaceGuard({
  load: async () => {
    const m = await loadBlazeface();
    // annotateBoxes=true: without it blazeface drops the probability
    return { estimateFaces: (input: never) => m.estimateFaces(input as HTMLCanvasElement, false, false, true) };
  },
  onHardFail: (why) => console.warn('[face-guard] face detector unavailable, capture continues UNCHECKED (banner shown):', why),
});

/** Start the download (idempotent): the capture route on open, the home screen when capture is next. */
export const startFaceGuard = (): void => guard.start();
export const faceGuardStatus = (): GuardStatus => guard.status();
export const faceGuardSettled = (): Promise<'ready' | 'failed'> => guard.settled();

/** The guard's status as React state; starts the load on first use. */
export function useFaceGuardStatus(): GuardStatus {
  return useSyncExternalStore(
    (fn) => { const off = guard.subscribe(fn); guard.start(); return off; },
    () => guard.status(),
    () => 'idle',
  );
}

const sizeOf = (src: FaceSource): { w: number; h: number } =>
  typeof HTMLVideoElement !== 'undefined' && src instanceof HTMLVideoElement ? { w: src.videoWidth, h: src.videoHeight }
    : typeof HTMLImageElement !== 'undefined' && src instanceof HTMLImageElement ? { w: src.naturalWidth, h: src.naturalHeight }
      : { w: src.width, h: src.height };

/** Letterbox the frame onto a fresh square canvas, synchronously: the check owns this copy. */
function prepare(src: FaceSource): PreparedFrame {
  const { w, h } = sizeOf(src);
  if (!(w > 0) || !(h > 0)) throw new Error('empty frame');
  const geom = letterbox(w, h);
  const canvas = document.createElement('canvas');
  canvas.width = geom.side;
  canvas.height = geom.side;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('no 2d context');
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, geom.side, geom.side);
  ctx.drawImage(src, geom.dx, geom.dy, geom.drawW, geom.drawH);
  return { input: canvas, geom, frameW: w, frameH: h };
}

/**
 * 'clear' and 'skipped' (hard failure, fail open) may upload; 'face', 'error' (this frame's check threw)
 * and 'not-ready' may not.
 */
export function checkFrame(src: FaceSource): Promise<GuardVerdict> {
  return guard.check(() => prepare(src));
}
