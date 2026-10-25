export type StudentNavId = 'home' | 'capture' | 'tag' | 'train' | 'results';

export interface StudentNavItem {
  readonly id: StudentNavId;
  readonly href: string;
  readonly label: string;
}

export const STUDENT_NAV: readonly StudentNavItem[] = [
  { id: 'home', href: '/student', label: 'בית' },
  { id: 'capture', href: '/student/capture', label: 'צילום' },
  { id: 'tag', href: '/student/tag', label: 'תיוג' },
  { id: 'train', href: '/student/train', label: 'אימון' },
  { id: 'results', href: '/student/results', label: 'תוצאות' },
];

const HOME = '/student';

export function isStudentNavActive(pathname: string | null, href: string): boolean {
  if (!pathname) return false;
  if (href === HOME) return pathname === HOME;
  return pathname === href || pathname.startsWith(`${href}/`);
}
