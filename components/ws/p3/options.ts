// Hebrew option lists shared by the P3 screens (orgs, workshops, staff, field definitions).
import type { InlineOption } from '../InlineEdit';
import type {
  DeviceMode, FieldEntity, FieldType, OrgKind, OrgStatus, StaffRole, WorkshopFormat, WorkshopRole,
} from '../../../lib/ws/types';

const opts = <T extends string>(map: Record<T, string>): InlineOption[] =>
  (Object.keys(map) as T[]).map((value) => ({ value, label: map[value] }));

export const ORG_KIND_LABELS: Record<OrgKind, string> = {
  school: 'בית ספר', company: 'חברה', municipality: 'רשות', ngo: 'עמותה', other: 'אחר',
};
export const ORG_STATUS_LABELS: Record<OrgStatus, string> = {
  lead: 'ליד', active: 'פעיל', paused: 'מושהה', archived: 'בארכיון',
};
export const FORMAT_LABELS: Record<WorkshopFormat, string> = {
  sessions: '6 מפגשים', hackathon: 'האקתון יום', custom: 'מותאם',
};
export const DEVICE_LABELS: Record<DeviceMode, string> = {
  own_phones: 'טלפונים אישיים', tablets_addon: 'טאבלטים', mixed: 'משולב',
};
export const WORKSHOP_ROLE_LABELS: Record<WorkshopRole, string> = {
  lead: 'מוביל', instructor: 'מדריך', assistant: 'עוזר', observer: 'צופה',
};
export const STAFF_ROLE_LABELS: Record<StaffRole, string> = {
  owner: 'בעלים', admin: 'מנהל', instructor: 'מדריך', guest: 'אורח',
};
export const ENTITY_LABELS: Record<FieldEntity, string> = {
  organization: 'ארגון', workshop: 'סדנה', group: 'קבוצה', participant: 'משתתף',
};
export const FIELD_TYPE_LABELS: Record<FieldType, string> = {
  text: 'טקסט', number: 'מספר', date: 'תאריך', boolean: 'כן / לא', select: 'בחירה',
  multiselect: 'בחירה מרובה', url: 'קישור',
};

export const ORG_KIND_OPTIONS = opts(ORG_KIND_LABELS);
export const ORG_STATUS_OPTIONS = opts(ORG_STATUS_LABELS);
export const FORMAT_OPTIONS = opts(FORMAT_LABELS);
export const DEVICE_OPTIONS = opts(DEVICE_LABELS);
export const WORKSHOP_ROLE_OPTIONS = opts(WORKSHOP_ROLE_LABELS);
export const ENTITY_OPTIONS = opts(ENTITY_LABELS);
export const FIELD_TYPE_OPTIONS = opts(FIELD_TYPE_LABELS);
/** roles an admin may grant through ws_add_staff (owner is SQL only) */
export const GRANTABLE_ROLE_OPTIONS = opts<Exclude<StaffRole, 'owner'>>({
  admin: STAFF_ROLE_LABELS.admin, instructor: STAFF_ROLE_LABELS.instructor, guest: STAFF_ROLE_LABELS.guest,
});
