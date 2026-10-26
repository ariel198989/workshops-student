import type { StudentCaps } from './caps';

export type StudentNavId = 'home' | 'capture' | 'tag' | 'train' | 'results' | 'check';

export interface StudentNavItem {
  readonly id: StudentNavId;
  readonly href: string;
  readonly label: string;
}

/** The full cycle, in the agreed order. What a given student sees is studentNavFor(). */
export const STUDENT_NAV: readonly StudentNavItem[] = [
  { id: 'home', href: '/', label: 'בית' },
  { id: 'capture', href: '/capture', label: 'צילום' },
  { id: 'tag', href: '/tag', label: 'תיוג' },
  { id: 'train', href: '/train', label: 'אימון' },
  { id: 'results', href: '/results', label: 'תוצאות' },
];

/** Shown only when the workshop has concept-check modules. */
export const CHECK_NAV: StudentNavItem = { id: 'check', href: '/check', label: 'בדיקה' };

const HOME = '/';

const CAP_OF: Readonly<Partial<Record<StudentNavId, keyof StudentCaps>>> = {
  capture: 'can_capture',
  tag: 'can_tag',
  train: 'can_train',
  results: 'can_view_model',
};

/** Nav items this student may open: home always, cycle steps per caps, 'בדיקה' when there are checks. */
export function studentNavFor(caps: StudentCaps, checksCount: number): StudentNavItem[] {
  const cycle = STUDENT_NAV.filter((item) => {
    const cap = CAP_OF[item.id];
    return cap ? caps[cap] === true : true;
  });
  return checksCount > 0 ? [...cycle, CHECK_NAV] : cycle;
}

export function isStudentNavActive(pathname: string | null, href: string): boolean {
  if (!pathname) return false;
  if (href === HOME) return pathname === HOME;
  return pathname === href || pathname.startsWith(`${href}/`);
}
