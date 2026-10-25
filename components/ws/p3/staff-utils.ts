// Who may change whom on the /staff screen. The DB guard (ws_guard_staff) only protects owners;
// the rest of this policy is a UI rule: only an owner touches admins, nobody edits themselves.
import type { StaffRole } from '../../../lib/ws/types';

export type EditableRole = Exclude<StaffRole, 'owner'>;

export interface StaffPolicy {
  canChangeRole: boolean;
  canToggleActive: boolean;
  roleOptions: EditableRole[];
}

const NONE: StaffPolicy = { canChangeRole: false, canToggleActive: false, roleOptions: [] };

export function staffPolicy(
  viewerRole: StaffRole | null, viewerId: string | null, row: { user_id: string; role: StaffRole },
): StaffPolicy {
  if (viewerRole !== 'owner' && viewerRole !== 'admin') return NONE;
  if (row.user_id === viewerId || row.role === 'owner') return NONE;
  if (row.role === 'admin' && viewerRole !== 'owner') return NONE;
  const roleOptions: EditableRole[] = viewerRole === 'owner' ? ['admin', 'instructor', 'guest'] : ['instructor', 'guest'];
  return { canChangeRole: true, canToggleActive: true, roleOptions };
}
