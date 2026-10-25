// Pure drag-and-drop helpers (no React, unit tested).

/** custom MIME so unrelated drags (text, files) never trigger a move */
export const MEMBER_MIME = 'application/x-ws-member';

export interface MemberDrag { readonly participantId: string; readonly fromGroupId: string | null }

export const encodeMemberDrag = (payload: MemberDrag): string => JSON.stringify(payload);

/** Validates untrusted dataTransfer text; null when it is not a member drag. */
export function parseMemberDrag(raw: string): MemberDrag | null {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  const { participantId, fromGroupId } = value as Record<string, unknown>;
  if (typeof participantId !== 'string' || participantId === '') return null;
  if (fromGroupId !== undefined && fromGroupId !== null && typeof fromGroupId !== 'string') return null;
  return { participantId, fromGroupId: typeof fromGroupId === 'string' ? fromGroupId : null };
}

/** Moves `dragId` to the slot of `overId`. Always returns a new array holding the complete id set. */
export function reorderIds(ids: readonly string[], dragId: string, overId: string): string[] {
  const from = ids.indexOf(dragId);
  const to = ids.indexOf(overId);
  if (from < 0 || to < 0 || from === to) return [...ids];
  const out = ids.filter((id) => id !== dragId);
  out.splice(to, 0, dragId);
  return out;
}

/** Optimistic participant move: new array, only the moved row is replaced. */
export function applyMove<T extends { id: string; group_id: string | null }>(
  rows: readonly T[], participantId: string, groupId: string | null,
): T[] {
  return rows.map((r) => (r.id === participantId ? { ...r, group_id: groupId } : r));
}
