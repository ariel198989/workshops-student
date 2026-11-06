// Privacy guard "objects, not people" (Amendment 13 + school rules): the pure decision on what a
// face detector saw in a frame. No imports on purpose: unit tested under plain Node.

/** Below this detector score a box is noise, not a face. */
export const MIN_FACE_SCORE = 0.8;
/** A face smaller than this share of the frame (a poster far away, a passer-by) does not block. */
export const MIN_FACE_AREA = 0.03;
/** How long a shot may wait for the detector to finish loading before the guard is skipped. */
export const GUARD_LOAD_TIMEOUT_MS = 8000;

/** Shown to the student instead of uploading. Short and kind: the readers are 6 to 18. */
export const FACE_MESSAGE = 'רואים בתמונה פנים. מצלמים רק חפצים, נסו שוב.';
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

/** clear: no face, upload. face: do not upload. skipped: the detector is unavailable, upload (fail open). */
export type GuardVerdict = 'clear' | 'face' | 'skipped';

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

/** The verdict for one frame. `faces === null` means the detector did not run (fail open). */
export function decideFaces(faces: readonly FaceBoxLike[] | null, frameW: number, frameH: number): GuardVerdict {
  if (faces === null) return 'skipped';
  return faces.some((f) => isBlockingFace(f, frameW, frameH)) ? 'face' : 'clear';
}

/** Only a face verdict keeps a photo from uploading; a skipped guard lets it through. */
export const mayUpload = (v: GuardVerdict): v is Exclude<GuardVerdict, 'face'> => v !== 'face';
