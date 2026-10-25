// Pure matching rules for "is this the same student?" (no React, unit tested).
// ws_link_participant(roster_row, user_id) puts the account on the roster row and deletes the
// auto-created 'signup' duplicate, so a valid pair is always one roster row without an account
// plus one signup row that has an account.

export interface LinkRow {
  id: string;
  full_name: string;
  user_id: string | null;
  source: 'roster' | 'signup' | 'manual';
  status: 'invited' | 'active' | 'withdrawn';
}

const isOpenRoster = (r: LinkRow): boolean => r.user_id === null && r.source !== 'signup';
const isOpenSignup = (r: LinkRow): boolean => r.user_id !== null && r.source === 'signup';

/** Rows that could be the same student as `base`. Withdrawn rows are never offered. */
export function linkCandidates<T extends LinkRow>(base: LinkRow, rows: readonly T[]): T[] {
  const wanted = isOpenRoster(base) ? isOpenSignup : isOpenSignup(base) ? isOpenRoster : null;
  if (!wanted) return [];
  return rows.filter((r) => r.id !== base.id && r.status !== 'withdrawn' && wanted(r));
}

export interface LinkArgs { participantId: string; userId: string }

/** Arguments for linkParticipant, or null when the pair is not one roster plus one signup. */
export function linkArgs(a: LinkRow, b: LinkRow): LinkArgs | null {
  const roster = [a, b].find(isOpenRoster);
  const signup = [a, b].find(isOpenSignup);
  return roster && signup && signup.user_id ? { participantId: roster.id, userId: signup.user_id } : null;
}
