import { attendanceMap, attendanceRate, type AttendanceMark } from '../../../lib/ws/attendance';
import type { DeliverableStatus, ParticipantStatus, SkipReason, WorkshopStatus } from '../../../lib/ws/types';

// Client preview of ws_issue_certificates: same rules and the same order of reasons as the RPC.
export const DEFAULT_MIN_ATTENDANCE = 0.5;

export interface EligibilityInput {
  participants: readonly { id: string; full_name: string; group_id: string | null; status: ParticipantStatus }[];
  sessions: readonly { id: string; attendance_taken: boolean }[];
  attendance: readonly AttendanceMark[];
  deliverables: readonly { group_id: string; status: DeliverableStatus }[];
  certifiedParticipantIds: ReadonlySet<string>;
  minAttendance: number;
  requireDeliverable: boolean;
}

export interface EligibilityRow {
  participantId: string;
  fullName: string;
  groupId: string | null;
  attendance: number;
  deliverableStatus: DeliverableStatus | null;
  reason: SkipReason | null;
}

export const SKIP_REASON_LABELS: Record<SkipReason, string> = {
  already_issued: 'כבר הונפקה תעודה',
  attendance: 'נוכחות נמוכה מהסף',
  deliverable: 'התוצר לא הוגש',
};

const SUBMITTED: readonly DeliverableStatus[] = ['submitted', 'approved'];

export function computeEligibility(input: EligibilityInput): EligibilityRow[] {
  const marks = attendanceMap(input.attendance);
  const taken = input.sessions.filter((s) => s.attendance_taken).map((s) => s.id);
  const byGroup = new Map(input.deliverables.map((d) => [d.group_id, d.status]));
  return input.participants
    .filter((p) => p.status === 'active')
    .map((p) => {
      const rate = attendanceRate(marks, p.id, taken);
      const deliverableStatus = p.group_id ? (byGroup.get(p.group_id) ?? null) : null;
      return { participantId: p.id, fullName: p.full_name, groupId: p.group_id, attendance: rate, deliverableStatus,
        reason: reasonFor(input, p.id, rate, deliverableStatus) };
    });
}

function reasonFor(
  input: EligibilityInput, participantId: string, rate: number, status: DeliverableStatus | null,
): SkipReason | null {
  if (input.certifiedParticipantIds.has(participantId)) return 'already_issued';
  if (rate < input.minAttendance) return 'attendance';
  if (input.requireDeliverable && !(status && SUBMITTED.includes(status))) return 'deliverable';
  return null;
}

export function summarize(rows: readonly EligibilityRow[]): { eligible: number; skipped: number; total: number } {
  const eligible = rows.filter((r) => r.reason === null).length;
  return { eligible, skipped: rows.length - eligible, total: rows.length };
}

export const canIssueInStatus = (status: WorkshopStatus): boolean => status === 'live' || status === 'completed';
