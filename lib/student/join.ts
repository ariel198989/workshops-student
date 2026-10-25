import { sb } from '../db';
import { whoami as fetchWhoami, wsAuthStore } from '../ws/staff';
import { reloadStudentContext } from './context';
import { joinErrorMessage } from './labels';

export interface FoundGroup { id: string; number: number; display_name: string | null; members: number; capacity: number | null }
export interface FoundWorkshop { id: string; title: string; code: string; organization: string | null; status: string; groups: FoundGroup[] }
export interface JoinResult { workshop_id: string; participant_id: string; group_id: string; team_name: string }

/** Error whose message is already safe, Hebrew copy for the student. */
export class JoinError extends Error {}

export async function findWorkshop(code: string): Promise<FoundWorkshop | null> {
  const { data, error } = await sb.rpc('ws_find_workshop', { p_code: code });
  if (error) throw new JoinError(joinErrorMessage(error));
  return (data as FoundWorkshop | null) ?? null;
}

export async function joinGroup(code: string, groupId: string, fullName: string): Promise<JoinResult> {
  const { data, error } = await sb.rpc('ws_join_group', { p_code: code, p_group: groupId, p_full_name: fullName.trim() });
  if (error) throw new JoinError(joinErrorMessage(error));
  return data as JoinResult;
}

/**
 * After joining, the cached whoami still says "no participations". Refresh it before navigating,
 * otherwise the route guard would bounce the student straight back to the join page.
 */
export async function refreshAfterJoin(): Promise<void> {
  const w = await fetchWhoami();
  wsAuthStore.set({ whoami: w, loaded: true });
  await reloadStudentContext();
}
