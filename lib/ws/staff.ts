import { sb } from '../db';
import { createStore } from '../store';
import type { StaffRole, WorkshopRole, Whoami, WsStaff } from './types';

export async function whoami(): Promise<Whoami> {
  const { data, error } = await sb.rpc('ws_whoami');
  if (error) throw error;
  return data as Whoami;
}

export const wsAuthStore = createStore<{ whoami: Whoami | null; loaded: boolean }>({ whoami: null, loaded: false });

// Mirrors ws_is_admin / ws_is_core_staff / ws_can_edit_workshop / ws_is_workshop_staff.
// whoami().staff is null for inactive staff, so a null staff never grants anything.
const ADMIN_ROLES: readonly StaffRole[] = ['owner', 'admin'];
const CORE_ROLES: readonly StaffRole[] = ['owner', 'admin', 'instructor'];
const EDIT_ROLES: readonly WorkshopRole[] = ['lead', 'instructor', 'assistant'];

export const isAdmin = (w: Whoami | null): boolean => !!w?.staff && ADMIN_ROLES.includes(w.staff.role);

export const isCoreStaff = (w: Whoami | null): boolean => !!w?.staff && CORE_ROLES.includes(w.staff.role);

export function canEdit(w: Whoami | null, workshopId: string): boolean {
  if (!w?.staff) return false;
  return isAdmin(w) || w.workshops.some((x) => x.workshop_id === workshopId && EDIT_ROLES.includes(x.role));
}

export function canView(w: Whoami | null, workshopId: string): boolean {
  if (!w?.staff) return false;
  return isAdmin(w) || w.workshops.some((x) => x.workshop_id === workshopId);
}

export async function listStaff(): Promise<WsStaff[]> {
  const { data, error } = await sb.from('ws_staff').select('*').order('full_name');
  if (error) throw error;
  return data as WsStaff[];
}

export async function updateStaff(
  userId: string, patch: Partial<Pick<WsStaff, 'role' | 'active' | 'full_name' | 'phone'>>,
): Promise<WsStaff> {
  const { data, error } = await sb.from('ws_staff').update(patch).eq('user_id', userId).select().single();
  if (error) throw error;
  return data as WsStaff;
}

/** POST to our own API route with the caller's session JWT; throws with the route's error message. */
export async function authedPost<T>(url: string, body?: unknown): Promise<T> {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) throw new Error('לא מחובר');
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = (await res.json().catch(() => ({}))) as { error?: string } & Record<string, unknown>;
  if (!res.ok) throw new Error(json.error ?? `שגיאה ${res.status}`);
  return json as T;
}

export const inviteStaff = (input: { email: string; role: Exclude<StaffRole, 'owner'>; full_name?: string }): Promise<{ user_id: string }> =>
  authedPost<{ user_id: string }>('/api/staff/invite', input);

// ── P3: platform staff management (ws_add_staff is admin-only, owner is granted via SQL) ──
export type GrantableRole = Exclude<StaffRole, 'owner'>;

/** Adds (or re-activates) staff for an existing auth account. Throws P0002 when the email has no account. */
export async function addExistingStaff(email: string, role: GrantableRole, fullName?: string): Promise<string> {
  const { data, error } = await sb.rpc('ws_add_staff', {
    p_email: email.trim(), p_role: role, p_full_name: fullName?.trim() || null,
  });
  if (error) throw error;
  return data as string;
}

export const updateStaffRole = (userId: string, role: StaffRole): Promise<WsStaff> => updateStaff(userId, { role });

export const setStaffActive = (userId: string, active: boolean): Promise<WsStaff> => updateStaff(userId, { active });
