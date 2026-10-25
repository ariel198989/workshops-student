'use client';
// Browser camera helpers: rear camera stream, JPEG grab, quality check, wake lock.
import { fitWithin, JPEG_QUALITY, MAX_SIDE } from './capture-utils';
import { assessPixels, type FrameQuality } from './quality';

const QUALITY_WIDTH = 160;

export function cameraErrorMessage(e: unknown): string {
  const name = e instanceof DOMException ? e.name : '';
  if (name === 'NotAllowedError' || name === 'SecurityError') return 'אין הרשאת מצלמה. אפשרו אותה בהגדרות הדפדפן ורעננו את הדף.';
  if (name === 'NotFoundError' || name === 'OverconstrainedError') return 'לא נמצאה מצלמה במכשיר הזה.';
  if (name === 'NotReadableError') return 'המצלמה בשימוש של אפליקציה אחרת. סגרו אותה ונסו שוב.';
  if (!navigator.mediaDevices?.getUserMedia) return 'הדפדפן הזה לא תומך במצלמה (צריך חיבור מאובטח).';
  return 'המצלמה לא נפתחה. נסו לרענן את הדף.';
}

/** Rear camera, 720p-ish; the caller owns the stream and must stop it. */
export async function openRearCamera(): Promise<MediaStream> {
  if (!navigator.mediaDevices?.getUserMedia) throw new Error('unsupported');
  return navigator.mediaDevices.getUserMedia({
    video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
    audio: false,
  });
}

export const stopStream = (s: MediaStream | null): void => s?.getTracks().forEach((t) => t.stop());

export function videoReady(v: HTMLVideoElement | null): v is HTMLVideoElement {
  return !!v && v.videoWidth > 0 && v.readyState >= 2;
}

/** Current video frame as a JPEG, longest side <= 1280. */
export function grabJpeg(v: HTMLVideoElement, scratch: HTMLCanvasElement): Promise<Blob | null> {
  const { w, h } = fitWithin(v.videoWidth, v.videoHeight, MAX_SIDE);
  scratch.width = w;
  scratch.height = h;
  scratch.getContext('2d')?.drawImage(v, 0, 0, w, h);
  return new Promise((resolve) => scratch.toBlob(resolve, 'image/jpeg', JPEG_QUALITY));
}

export function frameQuality(v: HTMLVideoElement): FrameQuality {
  const w = QUALITY_WIDTH;
  const h = Math.max(1, Math.round((v.videoHeight * w) / v.videoWidth));
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  const ctx = cv.getContext('2d', { willReadFrequently: true });
  if (!ctx) return { ok: true, reason: null }; // never let the checker itself block capture
  ctx.drawImage(v, 0, 0, w, h);
  return assessPixels(ctx.getImageData(0, 0, w, h).data, w, h);
}

type WakeLockLike = { release: () => Promise<void> };

/** Keep the screen awake during minutes of hands-off auto capture. Returns a release function. */
export async function holdScreenAwake(): Promise<() => void> {
  const wl = (navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<WakeLockLike> } }).wakeLock;
  try {
    const lock = await wl?.request('screen');
    return () => { void lock?.release().catch(() => undefined); };
  } catch {
    return () => undefined;
  }
}

/** Load a picked/taken photo into an <img> the engine can read. Caller revokes the URL. */
export async function imageFromFile(file: File): Promise<{ img: HTMLImageElement; url: string }> {
  const url = URL.createObjectURL(file);
  const img = new Image();
  try {
    await new Promise<void>((res, rej) => { img.onload = () => res(); img.onerror = () => rej(new Error('התמונה לא נפתחה')); img.src = url; });
  } catch (e) {
    URL.revokeObjectURL(url);
    throw e;
  }
  return { img, url };
}
