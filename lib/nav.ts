import type { StaffRole } from './shell-access';

export type NavId =
  | 'dashboard' | 'workshops' | 'orgs' | 'curriculum' | 'models' | 'certificates' | 'staff' | 'settings';

export interface NavItem {
  readonly id: NavId;
  readonly href: string;
  readonly label: string;
  /** when set, the item is shown only to these platform roles */
  readonly roles?: readonly StaffRole[];
}

export const NAV_ITEMS: readonly NavItem[] = [
  { id: 'dashboard', href: '/', label: 'לוח בקרה' },
  { id: 'workshops', href: '/workshops', label: 'סדנאות' },
  { id: 'orgs', href: '/orgs', label: 'ארגונים' },
  { id: 'curriculum', href: '/curriculum', label: 'תבניות וקוריקולום' },
  { id: 'models', href: '/models', label: 'מודלים ודאטה' },
  { id: 'certificates', href: '/certificates', label: 'תעודות' },
  { id: 'staff', href: '/staff', label: 'צוות', roles: ['owner', 'admin'] },
  { id: 'settings', href: '/settings', label: 'הגדרות' },
];

export function visibleNavItems(role: StaffRole | null | undefined): readonly NavItem[] {
  return NAV_ITEMS.filter((item) => !item.roles || (role != null && item.roles.includes(role)));
}

export function isActive(pathname: string | null, href: string): boolean {
  if (!pathname) return false;
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}
