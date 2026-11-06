// Privacy guard "objects, not people" (Amendment 13 + school rules): the pure decision on what a
// face detector saw in a frame, the detector's load lifecycle, and what the capture screen may do in
// each state. No imports on purpose: unit tested under plain Node (the browser half is face-detector.ts).

/** Below this detector score a box is noise, not a face. */
export const MIN_FACE_SCORE = 0.8;
/** A face smaller than this share of the frame (a poster far away, a passer-by) does not block. */
export const MIN_FACE_AREA = 0.03;
/**
 * One shared deadline from the first start(): a detector that is not ready by then is a HARD failure
 * (as is a rejected load), and only then may capture go on without it, under a visible banner.
 */
export const GUARD_HARD_FAIL_MS = 20000;
/** BlazeFace reads a square; frames are letterboxed onto a square of this side first. */
export const GUARD_SQUARE = 256;

/** Shown to the student instead of uploading. Short and kind: the readers are 6 to 18. */
export const FACE_MESSAGE = 'רואים בתמונה פנים. מצלמים רק חפצים, נסו שוב.';
/** While the detector loads: the shutter and the series button wait for it. */
export const GUARD_PREPARING = 'מכינים את בודק הפרטיות...';
/** One frame could not be checked: that frame is not uploaded, the student shoots again. */
export const GUARD_RETRY = 'לא הצלחנו לבדוק את התמונה. צלמו שוב.';
/** Persistent banner on the capture screen after a hard load failure (capture goes on, unchecked). */
export const GUARD_OFF_BANNER = 'בודק הפרטיות לא פעיל במכשיר הזה. מצלמים רק חפצים, בלי אנשים.';
/** Facilitator mode never uploads, so a face there is only a reminder. */
export const FACE_WARNING_FACILITATOR = 'רואים פנים בתמונה. מצלמים רק חפצים, כדאי למחוק אותה ולצלם שוב.';

/** After a gallery import in facilitator mode: how many of the learned frames show a face (null when none). */
export function galleryFaceNote(withFaces: number): string | null {
  if (!(withFaces > 0)) return null;
  const which = withFaces === 1 ? 'בתמונה אחת' : `ב-${withFaces} תמונות`;
  return `${which} מהגלריה רואים פנים. מצלמים רק חפצים, כדאי להזכיר לקבוצות.`;
}

/** The shape blazeface's estimateFaces(..., returnTensors=false) returns; anything else is ignored. */
export interface FaceBoxLike {
  topLeft?: unknown;
  bottomRight?: unknown;
  probability?: unknown;
}

/**
 * clear: no face, upload. face: do not upload. skipped: the detector HARD-failed, upload (fail open, banner).
 * error: this frame's check threw, do not upload, shoot again. not-ready: still loading, do not upload.
 */
export type GuardVerdict = 'clear' | 'face' | 'skipped' | 'error' | 'not-ready';
/** The two verdicts a photo may be uploaded with. */
export type UploadableVerdict = 'clear' | 'skipped';

function point(v: unknown): [number, number] | null {
  if (!v || typeof v !== 'object' || !('length' in v)) return null;
  const a = v as ArrayLike<unknown>;
  const x = Number(a[0]);
  const y = Number(a[1]);
  return Number.isFinite(x) && Number.isFinite(y) ? [x, y] : null;
}

/** The detector's score: a number or a one-element array; missing or malformed means 0. */
export function faceScore(f: FaceBoxLike): number {
  const p = f.probability;
  const n = typeof p === 'number' ? p : p && typeof p === 'object' && 'length' in p ? Number((p as ArrayLike<unknown>)[0]) : NaN;
  return Number.isFinite(n) ? n : 0;
}

/** The box's share of the frame, clipped to the frame (0 when the box or the frame is malformed). */
export function faceArea(f: FaceBoxLike, frameW: number, frameH: number): number {
  const a = point(f.topLeft);
  const b = point(f.bottomRight);
  if (!a || !b || !(frameW > 0) || !(frameH > 0)) return 0;
  const clip = (v: number, max: number) => Math.min(max, Math.max(0, v));
  const w = Math.abs(clip(b[0], frameW) - clip(a[0], frameW));
  const h = Math.abs(clip(b[1], frameH) - clip(a[1], frameH));
  return (w * h) / (frameW * frameH);
}

/** True when the box is a face we should act on: confident enough and big enough. */
export function isBlockingFace(f: FaceBoxLike, frameW: number, frameH: number): boolean {
  return faceScore(f) >= MIN_FACE_SCORE && faceArea(f, frameW, frameH) >= MIN_FACE_AREA;
}

/** The verdict for one frame. `faces === null` means the detector hard-failed (fail open). */
export function decideFaces(faces: readonly FaceBoxLike[] | null, frameW: number, frameH: number): GuardVerdict {
  if (faces === null) return 'skipped';
  return faces.some((f) => isBlockingFace(f, frameW, frameH)) ? 'face' : 'clear';
}

/** Only a checked-clear frame, or any frame after a hard detector failure, may be uploaded. */
export const mayUpload = (v: GuardVerdict): v is UploadableVerdict => v === 'clear' || v === 'skipped';

// ---------------------------------------------------------------- letterbox

/** Where a frame sits inside the square: scaled by `scale`, offset by (dx, dy), in square pixels. */
export interface SquareGeom { side: number; scale: number; dx: number; dy: number; drawW: number; drawH: number }

/** Fit the frame into a `side` square without changing its aspect (pad, never squash). */
export function letterbox(w: number, h: number, side = GUARD_SQUARE): SquareGeom {
  const long = Math.max(w, h);
  const scale = long > 0 ? side / long : 1;
  const drawW = w * scale;
  const drawH = h * scale;
  return { side, scale, dx: (side - drawW) / 2, dy: (side - drawH) / 2, drawW, drawH };
}

/** A box the detector found in the square, back in the original frame's pixels. */
export function fromSquare(f: FaceBoxLike, g: SquareGeom): FaceBoxLike {
  const back = (v: unknown): [number, number] | null => {
    const p = point(v);
    return p ? [(p[0] - g.dx) / g.scale, (p[1] - g.dy) / g.scale] : null;
  };
  return { topLeft: back(f.topLeft), bottomRight: back(f.bottomRight), probability: f.probability };
}

// ---------------------------------------------------------------- loader lifecycle

export type GuardStatus = 'idle' | 'loading' | 'ready' | 'failed';

export interface FaceModelLike { estimateFaces: (input: never) => Promise<readonly FaceBoxLike[]> }

/** What a check needs from the caller, produced synchronously and only once the model is ready. */
export interface PreparedFrame { input: unknown; geom: SquareGeom; frameW: number; frameH: number }

export interface FaceGuard {
  /** Start loading (idempotent). The one shared deadline starts with the first call. */
  start: () => void;
  status: () => GuardStatus;
  subscribe: (fn: (s: GuardStatus) => void) => () => void;
  /** Resolves when the guard is ready or hard-failed (starts it if needed). */
  settled: () => Promise<'ready' | 'failed'>;
  /** The verdict for one frame. `prepare` runs synchronously, only when the model is ready. */
  check: (prepare: () => PreparedFrame) => Promise<GuardVerdict>;
}

export interface FaceGuardDeps<M extends FaceModelLike> {
  load: () => Promise<M>;
  deadlineMs?: number;
  /** told once on a hard failure (the console line for the facilitator) */
  onHardFail?: (why: unknown) => void;
  setTimer?: (fn: () => void, ms: number) => unknown;
  clearTimer?: (t: unknown) => void;
}

/**
 * The detector's lifecycle. One load and one deadline for everybody, never a per-call timeout. After a
 * hard failure every check answers 'skipped' at once; a model that still arrives later turns the guard on.
 */
export function createFaceGuard<M extends FaceModelLike>(deps: FaceGuardDeps<M>): FaceGuard {
  const deadline = deps.deadlineMs ?? GUARD_HARD_FAIL_MS;
  const setTimer = deps.setTimer ?? ((fn: () => void, ms: number) => setTimeout(fn, ms));
  const clearTimer = deps.clearTimer ?? ((t: unknown) => clearTimeout(t as ReturnType<typeof setTimeout>));
  let state: GuardStatus = 'idle';
  let model: M | null = null;
  let timer: unknown = null;
  let told = false;
  const listeners = new Set<(s: GuardStatus) => void>();
  const waiters: ((s: 'ready' | 'failed') => void)[] = [];

  const set = (next: GuardStatus) => {
    if (state === next) return;
    state = next;
    listeners.forEach((fn) => fn(next));
    if (next === 'ready' || next === 'failed') waiters.splice(0).forEach((w) => w(next));
  };
  const stopTimer = () => {
    if (timer !== null) { clearTimer(timer); timer = null; }
  };
  const hardFail = (why: unknown) => {
    stopTimer();
    if (state === 'ready') return;
    if (!told) { told = true; deps.onHardFail?.(why); }
    set('failed');
  };

  function start(): void {
    if (state !== 'idle') return;
    set('loading');
    timer = setTimer(() => { timer = null; hardFail(`not ready after ${deadline} ms`); }, deadline);
    let loading: Promise<M>;
    try { loading = deps.load(); } catch (e) { hardFail(e); return; }
    loading.then((m) => { model = m; stopTimer(); set('ready'); }, (e) => hardFail(e));
  }

  return {
    start,
    status: () => state,
    subscribe: (fn) => { listeners.add(fn); return () => { listeners.delete(fn); }; },
    settled: () => {
      start();
      return state === 'ready' || state === 'failed' ? Promise.resolve(state) : new Promise((res) => { waiters.push(res); });
    },
    async check(prepare) {
      if (state === 'failed') return 'skipped';
      if (state !== 'ready' || !model) return 'not-ready';
      let frame: PreparedFrame;
      try { frame = prepare(); } catch { return 'error'; }
      try {
        const faces = await model.estimateFaces(frame.input as never);
        return decideFaces(faces.map((f) => fromSquare(f, frame.geom)), frame.frameW, frame.frameH);
      } catch {
        return 'error';
      }
    },
  };
}

// ---------------------------------------------------------------- capture gate

export interface CaptureGate {
  /** the shutter and the series button may be used */
  canShoot: boolean;
  /** show GUARD_OFF_BANNER for as long as this is true */
  banner: boolean;
  /** why the buttons wait; null when they do not */
  note: string | null;
}

/** What the capture screen does in each guard state: wait while loading, banner after a hard failure. */
export function captureGate(s: GuardStatus): CaptureGate {
  if (s === 'ready') return { canShoot: true, banner: false, note: null };
  if (s === 'failed') return { canShoot: true, banner: true, note: null };
  return { canShoot: false, banner: false, note: GUARD_PREPARING };
}

/** The home screen starts the download when the next step is capture. */
export const prefetchesGuard = (href: string | null | undefined): boolean => !!href && /^\/capture(\?|\/|$)/.test(href);
