// Pure routing rules for the student app. No Supabase or React imports, so Node can test it.
import type { Whoami } from '../ws/types';
import { isCaptureOnly, type StudentCaps } from './caps.ts';

export const STUDENT_HOME = '/';
export const STUDENT_JOIN = '/join';

/** Paths rendered without AuthGate and the student shell. */
export function isPublicPath(pathname: string | null): boolean {
  if (!pathname) return false;
  // /facilitator renders bare: its own layout gates on staff (FacilitatorGate)
  return pathname === '/verify' || pathname.startsWith('/verify/')
    || pathname === '/facilitator' || pathname.startsWith('/facilitator/');
}

/**
 * What the frame renders for a signed-in user:
 * public = bare page, student = student shell, redirect = send a new student to /join,
 * staff-notice = staff account that has no student side (points at the console),
 * denied = whoami could not be loaded.
 */
export type AccessDecision =
  | { kind: 'public' }
  | { kind: 'student' }
  | { kind: 'redirect'; to: string }
  | { kind: 'staff-notice' }
  | { kind: 'denied' };

export function decideAccess(whoami: Whoami | null, pathname: string | null, previewing: boolean): AccessDecision {
  if (isPublicPath(pathname)) return { kind: 'public' };
  if (!whoami) return { kind: 'denied' };
  if (whoami.participations.length > 0) return { kind: 'student' };
  if (whoami.staff !== null) return previewing ? { kind: 'student' } : { kind: 'staff-notice' };
  return pathname === STUDENT_JOIN ? { kind: 'student' } : { kind: 'redirect', to: STUDENT_JOIN };
}

// ── route gating by cycle depth ──

/** Routes a workshop can switch off. Everything else (home, join, certificate, verify) is always open. */
export type GatedRoute = 'capture' | 'tag' | 'train' | 'results' | 'check';

export function gatedRouteOf(pathname: string | null): GatedRoute | null {
  if (!pathname) return null;
  const [, first] = pathname.split('/');
  switch (first) {
    case 'capture': case 'tag': case 'train': case 'results': case 'check':
      return first;
    default:
      return null;
  }
}

const FACILITATOR_SHOWS = 'המדריך מאמן את המודל ומראה את התוצאה על המסך.';
const CAPTURE_ONLY = `התמונות שלכם עולות לגלריה של הקבוצה. ${FACILITATOR_SHOWS}`;

/** Who does this step instead of the students, said in one short sentence for the home banner. */
export function blockedReason(route: GatedRoute, caps: StudentCaps): string {
  if (isCaptureOnly(caps)) return CAPTURE_ONLY;
  switch (route) {
    case 'capture': return 'בסדנה הזאת המדריך מצלם ומראה את התמונות על המסך.';
    case 'tag': return 'בסדנה הזאת המדריך מתייג את התמונות ומראה אותן על המסך.';
    case 'train': return caps.can_tag
      ? 'תייגתם, ועכשיו תור המדריך: הוא מגיש את התמונות לאימון ומראה את התוצאה.'
      : FACILITATOR_SHOWS;
    case 'results': return FACILITATOR_SHOWS;
    case 'check': return 'אין בדיקת מושגים בסדנה הזאת.';
  }
}

export type RouteDecision = { allowed: true } | { allowed: false; reason: string };

/** May this student open the route? Ungated paths are always allowed. Pure. */
export function decideRoute(pathname: string | null, caps: StudentCaps, checksCount: number): RouteDecision {
  const route = gatedRouteOf(pathname);
  if (!route) return { allowed: true };
  const open = route === 'capture' ? caps.can_capture
    : route === 'tag' ? caps.can_tag && caps.tag_mode !== 'none'
    : route === 'train' ? caps.can_train
    : route === 'results' ? caps.can_view_model
    : checksCount > 0;
  return open ? { allowed: true } : { allowed: false, reason: blockedReason(route, caps) };
}
