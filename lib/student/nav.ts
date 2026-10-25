export type StudentNavId = 'home' | 'capture' | 'tag' | 'train' | 'results';

export interface StudentNavItem {
  readonly id: StudentNavId;
  readonly href: string;
  readonly label: string;
}

export const STUDENT_NAV: readonly StudentNavItem[] = [
  { id: 'home', href: '/', label: 'בית' },
  { id: 'capture', href: '/capture', label: 'צילום' },
  { id: 'tag', href: '/tag', label: 'תיוג' },
  { id: 'train', href: '/train', label: 'אימון' },
  { id: 'results', href: '/results', label: 'תוצאות' },
];

const HOME = '/';

export function isStudentNavActive(pathname: string | null, href: string): boolean {
  if (!pathname) return false;
  if (href === HOME) return pathname === HOME;
  return pathname === href || pathname.startsWith(`${href}/`);
}
