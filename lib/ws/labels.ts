import type {
  AttendanceStatus, CertificateStatus, DeliverableStatus, GroupStatus, ModuleRunStatus, OrgStatus,
  ParticipantStatus, ProblemStatus, SessionStatus, StaffRole, WorkshopStatus,
} from './types';

export const PILL_TONES = ['gray', 'blue', 'teal', 'green', 'navy', 'outline', 'red', 'amber'] as const;
export type PillTone = (typeof PILL_TONES)[number];
export interface PillEntry { label: string; tone: PillTone }

const e = (label: string, tone: PillTone): PillEntry => ({ label, tone });

// Record<Union, ...> makes tsc fail if a union value ever lacks a Hebrew label.
const WORKSHOP: Record<WorkshopStatus, PillEntry> = {
  draft: e('טיוטה', 'gray'), proposal: e('הצעה', 'blue'), confirmed: e('מאושרת', 'teal'),
  live: e('חי', 'green'), completed: e('הושלמה', 'navy'), archived: e('בארכיון', 'outline'),
  cancelled: e('בוטלה', 'red'),
};
const SESSION: Record<SessionStatus, PillEntry> = {
  planned: e('מתוכנן', 'gray'), scheduled: e('נקבע', 'blue'), live: e('חי', 'green'),
  done: e('הושלם', 'navy'), cancelled: e('בוטל', 'red'), postponed: e('נדחה', 'amber'),
};
const GROUP: Record<GroupStatus, PillEntry> = {
  forming: e('בהקמה', 'gray'), active: e('פעילה', 'green'), done: e('הסתיימה', 'navy'),
};
const DELIVERABLE: Record<DeliverableStatus, PillEntry> = {
  in_progress: e('בתהליך', 'gray'), submitted: e('הוגש', 'blue'), approved: e('אושר', 'teal'),
  returned: e('הוחזר', 'amber'),
};
const CERTIFICATE: Record<CertificateStatus, PillEntry> = {
  issued: e('הונפקה', 'navy'), revoked: e('בוטלה', 'red'),
};
const ORG: Record<OrgStatus, PillEntry> = {
  lead: e('ליד', 'blue'), active: e('פעיל', 'green'), paused: e('מושהה', 'amber'),
  archived: e('בארכיון', 'outline'),
};
const MODULE: Record<ModuleRunStatus, PillEntry> = {
  pending: e('ממתין', 'gray'), done: e('בוצע', 'navy'), partial: e('חלקי', 'amber'),
  skipped: e('דולג', 'outline'),
};
const ATTENDANCE: Record<AttendanceStatus, PillEntry> = {
  present: e('נוכח', 'green'), late: e('איחר', 'amber'), absent: e('נעדר', 'red'),
  excused: e('מוצדק', 'gray'),
};
const PARTICIPANT: Record<ParticipantStatus, PillEntry> = {
  invited: e('הוזמן', 'blue'), active: e('פעיל', 'green'), withdrawn: e('פרש', 'outline'),
};
const PROBLEM: Record<ProblemStatus, PillEntry> = {
  draft: e('טיוטה', 'gray'), presented: e('הוצגה', 'blue'), decomposed: e('פורקה', 'teal'),
  solved: e('נפתרה', 'navy'),
};

export const PILL_MAPS = {
  workshop: WORKSHOP, session: SESSION, group: GROUP, deliverable: DELIVERABLE,
  certificate: CERTIFICATE, org: ORG, module: MODULE, attendance: ATTENDANCE,
  participant: PARTICIPANT, problem: PROBLEM,
} as const;

export type PillKind = keyof typeof PILL_MAPS;
export const PILL_KINDS = Object.keys(PILL_MAPS) as PillKind[];

function entry(kind: PillKind, value: string): PillEntry | undefined {
  const map: Record<string, PillEntry> = PILL_MAPS[kind];
  return Object.hasOwn(map, value) ? map[value] : undefined;
}

export const labelOf = (kind: PillKind, value: string): string => entry(kind, value)?.label ?? value;

export const pillTone = (kind: PillKind, value: string): PillTone => entry(kind, value)?.tone ?? 'gray';

// Platform staff roles are not a lifecycle status, so they live outside PILL_MAPS
// (which ws-pure.test.ts pins to the status unions).
export const STAFF_ROLE_PILLS: Record<StaffRole, PillEntry> = {
  owner: e('בעלים', 'navy'), admin: e('מנהל', 'teal'), instructor: e('מדריך', 'blue'), guest: e('אורח', 'outline'),
};
