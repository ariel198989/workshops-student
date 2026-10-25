import type { StaffRole, Whoami } from './ws/types';

// The canonical types live in lib/ws/types; re-exported so nav.ts and tests keep one import site.
export type { StaffRole, Whoami };

const ROLE_LABELS: Readonly<Record<StaffRole, string>> = {
  owner: 'בעלים',
  admin: 'מנהל',
  instructor: 'מדריך',
  guest: 'אורח',
};

export function roleLabel(role: StaffRole | null | undefined): string {
  return role ? ROLE_LABELS[role] : '';
}

export const STUDENT_HOME = '/student';
export const STUDENT_JOIN = '/student/join';

/** Paths rendered without AuthGate and Shell. */
export function isPublicPath(pathname: string | null): boolean {
  if (!pathname) return false;
  return pathname === '/verify' || pathname.startsWith('/verify/');
}

export function isStudentPath(pathname: string | null): boolean {
  if (!pathname) return false;
  return pathname === STUDENT_HOME || pathname.startsWith(`${STUDENT_HOME}/`);
}

/**
 * What the frame renders for a signed-in user:
 * public = bare page, staff = console Shell, student = the /student layout owns the chrome,
 * redirect = send a student to where they belong, denied = whoami could not be loaded.
 */
export type RouteDecision =
  | { kind: 'public' }
  | { kind: 'staff' }
  | { kind: 'student' }
  | { kind: 'redirect'; to: string }
  | { kind: 'denied' };

export function decideRoute(whoami: Whoami | null, pathname: string | null): RouteDecision {
  if (isPublicPath(pathname)) return { kind: 'public' };
  if (!whoami) return { kind: 'denied' };
  const onStudent = isStudentPath(pathname);
  // staff keep the console and may open /student/* to preview the student experience
  if (whoami.staff !== null) return { kind: onStudent ? 'student' : 'staff' };
  if (whoami.participations.length === 0) {
    return pathname === STUDENT_JOIN ? { kind: 'student' } : { kind: 'redirect', to: STUDENT_JOIN };
  }
  return onStudent ? { kind: 'student' } : { kind: 'redirect', to: STUDENT_HOME };
}
