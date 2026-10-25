import { sb } from '../db';
import type { ParticipantPatch, ReconcileResult, WsParticipant } from './types';

const MAX_NAME = 80;

export type ParticipantWithGroup = WsParticipant & {
  group: { number: number; display_name: string | null } | null;
};

export async function listParticipants(workshopId: string): Promise<ParticipantWithGroup[]> {
  const { data, error } = await sb.from('ws_participants')
    .select('*, group:ws_groups(number, display_name)')
    .eq('workshop_id', workshopId).order('full_name');
  if (error) throw error;
  return data as ParticipantWithGroup[];
}

// Roster paste: trims, drops empties, dedupes (case-insensitive), caps at 80 chars (DB check).
export function cleanNames(names: readonly string[]): string[] {
  const seen = new Set<string>();
  return names
    .map((n) => n.trim().slice(0, MAX_NAME))
    .filter((n) => {
      const key = n.toLowerCase();
      if (!n || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

export async function addParticipants(
  workshopId: string, names: readonly string[], groupId?: string,
): Promise<WsParticipant[]> {
  const rows = cleanNames(names).map((full_name) => ({
    workshop_id: workshopId, group_id: groupId ?? null, full_name, source: 'roster', status: 'active',
  }));
  if (rows.length === 0) return [];
  const { data, error } = await sb.from('ws_participants').insert(rows).select();
  if (error) throw error;
  return data as WsParticipant[];
}

export async function updateParticipant(id: string, patch: ParticipantPatch): Promise<WsParticipant> {
  const { data, error } = await sb.from('ws_participants').update(patch).eq('id', id).select().single();
  if (error) throw error;
  return data as WsParticipant;
}

export async function reconcile(workshopId: string): Promise<ReconcileResult> {
  const { data, error } = await sb.rpc('ws_reconcile_participants', { p_workshop: workshopId });
  if (error) throw error;
  return data as ReconcileResult;
}

export async function linkParticipant(participantId: string, userId: string): Promise<WsParticipant> {
  const { data, error } = await sb.rpc('ws_link_participant', { p_participant: participantId, p_user: userId });
  if (error) throw error;
  return data as WsParticipant;
}

// groupId null = unassign
export async function moveParticipant(participantId: string, groupId: string | null): Promise<WsParticipant> {
  const { data, error } = await sb.rpc('ws_move_participant', { p_participant: participantId, p_group: groupId });
  if (error) throw error;
  return data as WsParticipant;
}
