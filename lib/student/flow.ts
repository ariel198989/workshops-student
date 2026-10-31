// The student's path through the cycle: which step comes after capture, and the slim stepper
// (צילום → תיוג → אימון → תוצאות → תעודה) that keeps the next step obvious on every screen.
// Pure: no React or Supabase, so Node can test it.
import { MIN_TRAIN_IMAGES } from '../cv/readiness.ts';
import { TARGET_FIRST } from '../cv/capture-utils.ts';
import { isPublicPath } from './access.ts';
import type { StudentCaps } from './caps.ts';
import { liveAllows, type LiveState } from './live.ts';
import type { StudentProgress } from './context';
import { isStudentNavActive } from './nav.ts';
import type { StorageLike } from './pending.ts';

export { MIN_TRAIN_IMAGES };

// ── after capture ──

export interface CaptureCounts {
  /** photos of the whole group already uploaded (server count + this session's saved uploads) */
  total: number;
  /** photos of the object being shot right now, when one is picked */
  active?: number;
}

export interface CaptureNext {
  href: string;
  label: string;
  countLabel: string;
  /** the group has enough photos for the next step: the button turns primary and the toast fires once */
  ready: boolean;
  /** the active object reached its first target (יעד 50) */
  classReady: boolean;
  readyToast: string;
  classToast: string;
}

export const photosLabel = (n: number): string => (n === 1 ? 'צילמתם תמונה אחת' : `צילמתם ${n} תמונות`);

/** What the bar under the shutter offers once there is at least one photo. */
export function nextAfterCapture(caps: StudentCaps, counts: CaptureCounts): CaptureNext {
  const canTag = caps.can_tag && caps.tag_mode !== 'none';
  const active = counts.active ?? 0;
  return {
    href: canTag ? '/tag' : '/',
    label: canTag ? 'לשלב הבא: תיוג' : 'סיימנו לצלם',
    countLabel: photosLabel(counts.total),
    ready: counts.total >= MIN_TRAIN_IMAGES,
    classReady: active >= TARGET_FIRST,
    readyToast: canTag ? 'יש מספיק תמונות. אפשר לעבור לתיוג' : 'יש מספיק תמונות. המדריך יכול להמשיך מכאן',
    classToast: `הגעתם ליעד ${TARGET_FIRST} לאובייקט הזה. אפשר לצלם אובייקט אחר או להמשיך`,
  };
}

// ── the stepper ──

export type FlowStepId = 'capture' | 'tag' | 'train' | 'results' | 'certificate';

export interface FlowStep {
  readonly id: FlowStepId;
  readonly href: string;
  readonly label: string;
  /** "לצילום", "לתיוג": the label as a destination */
  readonly to: string;
  readonly done: boolean;
  readonly current: boolean;
  /** the first step that is not done yet */
  readonly next: boolean;
  /** false when the facilitator's live lock keeps this route closed right now */
  readonly open: boolean;
}

export interface FlowProgress {
  photos: number;
  tagged: number;
  model: boolean;
  resultsSeen: boolean;
  certificate: boolean;
}

export const EMPTY_FLOW_PROGRESS: FlowProgress = { photos: 0, tagged: 0, model: false, resultsSeen: false, certificate: false };

/** The stepper's view of ws_my_context().progress; a missing progress counts as nothing done. */
export function flowProgressOf(progress: StudentProgress | null, certificate: boolean, resultsSeen: boolean): FlowProgress {
  return {
    photos: progress?.photos ?? 0,
    tagged: progress?.tagged ?? 0,
    model: !!progress?.model,
    resultsSeen,
    certificate,
  };
}

interface StepDef { id: FlowStepId; href: string; label: string; to: string; allowed: (caps: StudentCaps, p: FlowProgress) => boolean; done: (p: FlowProgress) => boolean }

const STEPS: readonly StepDef[] = [
  { id: 'capture', href: '/capture', label: 'צילום', to: 'לצילום', allowed: (c) => c.can_capture, done: (p) => p.photos > 0 },
  { id: 'tag', href: '/tag', label: 'תיוג', to: 'לתיוג', allowed: (c) => c.can_tag && c.tag_mode !== 'none', done: (p) => p.tagged >= MIN_TRAIN_IMAGES },
  { id: 'train', href: '/train', label: 'אימון', to: 'לאימון', allowed: (c) => c.can_train, done: (p) => p.model },
  { id: 'results', href: '/results', label: 'תוצאות', to: 'לתוצאות', allowed: (c) => c.can_view_model, done: (p) => p.model && p.resultsSeen },
  { id: 'certificate', href: '/certificate', label: 'תעודה', to: 'לתעודה', allowed: (_c, p) => p.certificate, done: () => false },
];

/** Paths where the stepper stays hidden even when the shell renders. */
const HIDDEN_PREFIXES = ['/facilitator', '/model', '/g', '/verify'];

export function flowHidden(pathname: string | null): boolean {
  if (!pathname) return false;
  if (isPublicPath(pathname)) return true;
  return HIDDEN_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/**
 * The gated routes this workshop opens to students, in cycle order, with done / current / next and the live lock.
 * Empty when the stepper has nothing to say: fewer than two steps, a hidden path, or no caps at all.
 */
export function flowSteps(caps: StudentCaps, progress: FlowProgress, live: LiveState | null, pathname: string | null): FlowStep[] {
  if (flowHidden(pathname)) return [];
  const defs = STEPS.filter((d) => d.allowed(caps, progress));
  if (defs.length < 2) return [];
  const nextDef = defs.find((d) => !d.done(progress)) ?? null;
  return defs.map((d) => ({
    id: d.id,
    href: d.href,
    label: d.label,
    to: d.to,
    done: d.done(progress),
    current: isStudentNavActive(pathname, d.href),
    next: d === nextDef,
    open: liveAllows(live, d.id),
  }));
}

/** The step the stepper points at, or null when every step is done. */
export const flowNext = (steps: FlowStep[]): FlowStep | null => steps.find((s) => s.next) ?? null;

/**
 * Button text for a destination, in the stepper's words: "לשלב הבא: תיוג" for a step still ahead,
 * "חזרה לצילום" for one already done, null for a path that is not a step (home, check).
 */
export function flowCta(steps: FlowStep[], href: string): string | null {
  const step = steps.find((s) => s.href === href);
  if (!step) return null;
  return step.done ? `חזרה ${step.to}` : `לשלב הבא: ${step.label}`;
}

// ── "results seen" (the only step whose completion is a visit, kept on the device) ──

export const resultsSeenKey = (team: string): string => `ws.resultsSeen.${team}`;

export function readResultsSeen(storage: StorageLike | null, team: string): boolean {
  try {
    return storage?.getItem(resultsSeenKey(team)) === '1';
  } catch {
    return false;
  }
}

export function writeResultsSeen(storage: StorageLike | null, team: string): void {
  try {
    storage?.setItem(resultsSeenKey(team), '1');
  } catch {
    // a blocked storage just means the tick does not persist
  }
}
