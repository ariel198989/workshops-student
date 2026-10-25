// Pure routing rules for the student app. No Supabase or React imports, so Node can test it.
import type { Whoami } from '../ws/types';

export const STUDENT_HOME = '/';
export const STUDENT_JOIN = '/join';

/** Paths rendered without AuthGate and the student shell. */
export function isPublicPath(pathname: string | null): boolean {
  if (!pathname) return false;
  return pathname === '/verify' || pathname.startsWith('/verify/');
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
