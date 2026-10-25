import { sb } from '../db';
import type { AttendanceStatus, WsAttendance } from './types';

export type AttendanceMark = Pick<WsAttendance, 'session_id' | 'participant_id' | 'status'>;
export type AttendanceMarks = ReadonlyMap<string, AttendanceStatus> | readonly AttendanceMark[];

export const attendanceKey = (sessionId: string, participantId: string): string => `${sessionId}:${participantId}`;

export function attendanceMap(rows: readonly AttendanceMark[]): Map<string, AttendanceStatus> {
  return new Map(rows.map((r) => [attendanceKey(r.session_id, r.participant_id), r.status]));
}

/**
 * Share of the given (already taken) sessions the participant attended (present or late).
 * Same rule as ws_issue_certificates: with no sessions the rate is 1.
 */
export function attendanceRate(marks: AttendanceMarks, participantId: string, doneSessionIds: readonly string[]): number {
  if (doneSessionIds.length === 0) return 1;
  const map = marks instanceof Map ? marks : attendanceMap(marks as readonly AttendanceMark[]);
  const attended = doneSessionIds.filter((sid) => {
    const status = map.get(attendanceKey(sid, participantId));
    return status === 'present' || status === 'late';
  }).length;
  return attended / doneSessionIds.length;
}

export async function listAttendance(workshopId: string): Promise<WsAttendance[]> {
  const { data, error } = await sb.from('ws_attendance').select('*').eq('workshop_id', workshopId).limit(5000);
  if (error) throw error;
  return data as WsAttendance[];
}

export interface MarkInput {
  session_id: string; participant_id: string; workshop_id: string; status: AttendanceStatus; note?: string;
}

const UPSERT_KEY = 'session_id,participant_id';

export async function markAttendance(input: MarkInput): Promise<void> {
  const { error } = await sb.from('ws_attendance').upsert(input, { onConflict: UPSERT_KEY });
  if (error) throw error;
}

export async function setAttendanceTaken(sessionId: string, taken: boolean): Promise<void> {
  const { error } = await sb.from('ws_sessions').update({ attendance_taken: taken }).eq('id', sessionId);
  if (error) throw error;
}

export async function markAllPresent(
  sessionId: string, workshopId: string, participantIds: readonly string[],
): Promise<void> {
  const rows = participantIds.map((participant_id) => ({
    session_id: sessionId, participant_id, workshop_id: workshopId, status: 'present',
  }));
  if (rows.length > 0) {
    const { error } = await sb.from('ws_attendance').upsert(rows, { onConflict: UPSERT_KEY });
    if (error) throw error;
  }
  await setAttendanceTaken(sessionId, true);
}
