'use client';
// Analyses the live video ~6 times a second on a 160px scratch canvas,
// stabilises the per-colour count (median of 5, then eased) and paints the
// detected-pixel mask onto an overlay canvas so the class sees what the
// camera sees.
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  analyzeFrame, maskToRgba, pushHistory, smoothCounts, stableCount, thresholdsForSensitivity, WORK_WIDTH, type BlobCounts,
} from '@/lib/vote/color-count';

const TARGET_FPS = 6;
const FRAME_MS = 1000 / TARGET_FPS;
const EASE_ALPHA = 0.35;

export interface VoteCount {
  /** Eased counts; round before showing. */
  readonly counts: BlobCounts;
  readonly frozen: boolean;
  readonly setFrozen: (f: boolean) => void;
  /** 0..1, 0.5 = default thresholds. */
  readonly sensitivity: number;
  readonly setSensitivity: (s: number) => void;
  readonly reset: () => void;
  readonly overlayRef: React.RefObject<HTMLCanvasElement | null>;
}

const ZERO: BlobCounts = { green: 0, red: 0 };

export function useVoteCount(video: React.RefObject<HTMLVideoElement | null>, enabled: boolean): VoteCount {
  const overlayRef = useRef<HTMLCanvasElement | null>(null);
  const [counts, setCounts] = useState<BlobCounts>(ZERO);
  const [frozen, setFrozen] = useState(false);
  const [sensitivity, setSensitivity] = useState(0.5);
  const frozenRef = useRef(frozen);
  const sensRef = useRef(sensitivity);
  const greenHist = useRef<number[]>([]);
  const redHist = useRef<number[]>([]);
  const eased = useRef<BlobCounts>(ZERO);
  frozenRef.current = frozen;
  sensRef.current = sensitivity;

  const reset = useCallback(() => {
    greenHist.current = [];
    redHist.current = [];
    eased.current = ZERO;
    setCounts(ZERO);
    const ctx = overlayRef.current?.getContext('2d');
    if (ctx && overlayRef.current) ctx.clearRect(0, 0, overlayRef.current.width, overlayRef.current.height);
  }, []);

  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    let raf = 0;
    let last = 0;
    const scratch = document.createElement('canvas');
    const sctx = scratch.getContext('2d', { willReadFrequently: true });

    const tick = (now: number) => {
      if (!alive) return;
      raf = requestAnimationFrame(tick);
      if (now - last < FRAME_MS || frozenRef.current) return;
      const v = video.current;
      if (!v || !sctx || v.videoWidth === 0 || v.readyState < 2) return;
      last = now;
      const w = Math.min(WORK_WIDTH, v.videoWidth);
      const h = Math.max(1, Math.round((v.videoHeight * w) / v.videoWidth));
      if (scratch.width !== w || scratch.height !== h) { scratch.width = w; scratch.height = h; }
      sctx.drawImage(v, 0, 0, w, h);
      const frame = analyzeFrame(sctx.getImageData(0, 0, w, h), { thresholds: thresholdsForSensitivity(sensRef.current) });
      greenHist.current = pushHistory(greenHist.current, frame.green);
      redHist.current = pushHistory(redHist.current, frame.red);
      const stable: BlobCounts = { green: stableCount(greenHist.current), red: stableCount(redHist.current) };
      eased.current = smoothCounts(eased.current, stable, EASE_ALPHA);
      setCounts(eased.current);
      paintOverlay(overlayRef.current, frame.mask, frame.width, frame.height);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      alive = false;
      cancelAnimationFrame(raf);
    };
  }, [enabled, video]);

  return { counts, frozen, setFrozen, sensitivity, setSensitivity, reset, overlayRef };
}

function paintOverlay(canvas: HTMLCanvasElement | null, mask: Uint8Array, w: number, h: number): void {
  if (!canvas) return;
  if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const img = ctx.createImageData(w, h);
  img.data.set(maskToRgba(mask));
  ctx.putImageData(img, 0, 0);
}
