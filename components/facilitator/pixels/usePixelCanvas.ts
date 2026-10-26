'use client';
// The draw loop behind PixelStep: ~12 fps, the video is boxed into a 128px
// scratch canvas, downsampled to the chosen level and painted as crisp squares
// on the big display canvas. Frozen = stop capturing, keep redrawing from the
// last frame so toggles still apply while the class argues.
import { useEffect, useRef, useState, type RefObject } from 'react';
import { videoReady } from '@/lib/cv/camera';
import {
  canShowDigits, downsample, FULL, toBrightnessDigits, toGray, toRgba, type PixelLevel,
} from '@/lib/pixels/pixelate';

const SCRATCH_WIDTH = 128;
const DISPLAY_WIDTH = 1024;
const FRAME_MS = 1000 / 12;

export type PixelView = { level: PixelLevel; gray: boolean; frozen: boolean; digits: boolean };

/** What the UI needs around the canvas: grid size, the digits (when shown) and the camera size. */
export type PixelInfo = {
  cols: number;
  rows: number;
  digits: number[] | null;
  fullSize: { width: number; height: number } | null;
};

const EMPTY: PixelInfo = { cols: 0, rows: 0, digits: null, fullSize: null };

function sameInfo(a: PixelInfo, b: PixelInfo): boolean {
  if (a.cols !== b.cols || a.rows !== b.rows) return false;
  if ((a.digits === null) !== (b.digits === null)) return false;
  if (a.digits && b.digits && a.digits.some((d, i) => d !== b.digits![i])) return false;
  return a.fullSize?.width === b.fullSize?.width && a.fullSize?.height === b.fullSize?.height;
}

function makeCanvas(width: number, height: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = width;
  c.height = height;
  return c;
}

function fitHeight(width: number, height: number, targetWidth: number): number {
  return Math.max(1, Math.round((height * targetWidth) / width));
}

type Captured = { small: ImageData; big: HTMLCanvasElement; width: number; height: number };

/** Copy the current video frame into the 128px scratch and the display-sized big canvas. */
function capture(video: HTMLVideoElement | null, scratch: HTMLCanvasElement, big: HTMLCanvasElement): Captured | null {
  if (!videoReady(video)) return null;
  const { videoWidth: vw, videoHeight: vh } = video;
  scratch.width = SCRATCH_WIDTH;
  scratch.height = fitHeight(vw, vh, SCRATCH_WIDTH);
  const sctx = scratch.getContext('2d', { willReadFrequently: true });
  if (!sctx) return null;
  sctx.drawImage(video, 0, 0, scratch.width, scratch.height);
  big.width = DISPLAY_WIDTH;
  big.height = fitHeight(vw, vh, DISPLAY_WIDTH);
  big.getContext('2d')?.drawImage(video, 0, 0, big.width, big.height);
  return { small: sctx.getImageData(0, 0, scratch.width, scratch.height), big, width: vw, height: vh };
}

function paintFull(canvas: HTMLCanvasElement, frame: Captured, gray: boolean): PixelInfo {
  canvas.width = frame.big.width;
  canvas.height = frame.big.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return EMPTY;
  ctx.imageSmoothingEnabled = true;
  ctx.filter = gray ? 'grayscale(1)' : 'none';
  ctx.drawImage(frame.big, 0, 0);
  ctx.filter = 'none';
  return { cols: 0, rows: 0, digits: null, fullSize: { width: frame.width, height: frame.height } };
}

function paintCells(canvas: HTMLCanvasElement, cellsCanvas: HTMLCanvasElement, frame: Captured, view: PixelView): PixelInfo {
  const level = view.level as number;
  const grid = downsample(frame.small, level);
  const rgb = view.gray ? toGray(grid.cells) : grid.cells;
  cellsCanvas.width = grid.cols;
  cellsCanvas.height = grid.rows;
  const cctx = cellsCanvas.getContext('2d');
  const ctx = canvas.getContext('2d');
  if (!cctx || !ctx) return EMPTY;
  const img = cctx.createImageData(grid.cols, grid.rows);
  img.data.set(toRgba(rgb));
  cctx.putImageData(img, 0, 0);
  canvas.width = DISPLAY_WIDTH;
  canvas.height = fitHeight(grid.cols, grid.rows, DISPLAY_WIDTH);
  ctx.imageSmoothingEnabled = false;
  ctx.filter = 'none';
  ctx.drawImage(cellsCanvas, 0, 0, canvas.width, canvas.height);
  const digits = view.digits && canShowDigits(level) ? toBrightnessDigits(grid.cells) : null;
  return { cols: grid.cols, rows: grid.rows, digits, fullSize: { width: frame.width, height: frame.height } };
}

export function usePixelCanvas(videoRef: RefObject<HTMLVideoElement | null>, live: boolean, view: PixelView) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scratchRef = useRef<HTMLCanvasElement | null>(null);
  const bigRef = useRef<HTMLCanvasElement | null>(null);
  const cellsRef = useRef<HTMLCanvasElement | null>(null);
  const frameRef = useRef<Captured | null>(null);
  const [info, setInfo] = useState<PixelInfo>(EMPTY);
  const { level, gray, frozen, digits } = view;

  useEffect(() => {
    if (!live) return;
    scratchRef.current ??= makeCanvas(SCRATCH_WIDTH, 1);
    bigRef.current ??= makeCanvas(DISPLAY_WIDTH, 1);
    cellsRef.current ??= makeCanvas(1, 1);
    const scratch = scratchRef.current;
    const big = bigRef.current;
    const cells = cellsRef.current;
    const current: PixelView = { level, gray, frozen, digits };

    const paint = () => {
      const canvas = canvasRef.current;
      const frame = frameRef.current;
      if (!canvas || !frame) return;
      const next = level === FULL ? paintFull(canvas, frame, gray) : paintCells(canvas, cells, frame, current);
      setInfo((prev) => (sameInfo(prev, next) ? prev : next));
    };

    if (frozen) { paint(); return; }

    let raf = 0;
    let last = 0;
    let disposed = false;
    const tick = (now: number) => {
      if (disposed) return;
      raf = requestAnimationFrame(tick);
      if (now - last < FRAME_MS) return;
      last = now;
      const got = capture(videoRef.current, scratch, big);
      if (got) frameRef.current = got;
      paint();
    };
    raf = requestAnimationFrame(tick);
    return () => { disposed = true; cancelAnimationFrame(raf); };
  }, [live, level, gray, frozen, digits, videoRef]);

  return { canvasRef, info };
}
