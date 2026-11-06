// The staff "group model from every photo" page (/facilitator/merge?w=&g=): who may use it and what
// it says. Pure, type-only imports: unit tested under plain Node. The data calls live in merge-api.ts.
import type { Whoami } from '../ws/types';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface MergeTarget { workshopId: string; groupId: string }

/** The two ids from the console link; null when either is missing or not a uuid. */
export function parseMergeParams(w: string | null | undefined, g: string | null | undefined): MergeTarget | null {
  const workshopId = (w ?? '').trim();
  const groupId = (g ?? '').trim();
  return UUID.test(workshopId) && UUID.test(groupId) ? { workshopId, groupId } : null;
}

/**
 * Mirrors ws_is_workshop_staff(): active staff who are owner/admin (every workshop) or assigned to this
 * workshop. The database enforces it again on every read, upload and insert; this only picks the message.
 */
export function isStaffOfWorkshop(who: Whoami | null | undefined, workshopId: string): boolean {
  if (!who?.staff) return false;
  if (who.staff.role === 'owner' || who.staff.role === 'admin') return true;
  return (who.workshops ?? []).some((w) => w.workshop_id === workshopId);
}

export const MERGE_NOT_STAFF = 'הדף הזה פתוח רק לצוות של הסדנה הזאת. התחברו עם חשבון צוות שמשויך אליה.';
export const MERGE_BAD_LINK = 'הקישור חסר או שגוי. פתחו את הדף מהקונסול, מכרטיס הקבוצה.';
export const MERGE_NO_GROUP = 'הקבוצה לא נמצאה בסדנה הזאת, או שאין לחשבון הזה גישה אליה.';
export const MERGE_BUTTON = 'אימון מודל קבוצתי מכל התמונות';

export const groupLabel = (g: { display_name: string | null; number: number }): string =>
  g.display_name?.trim() || `קבוצה ${g.number}`;

/** "3 חברים צילמו" with the singular for one; nobody yet is said plainly. */
export function contributorsLabel(n: number): string {
  if (!(n > 0)) return 'עוד אף אחד לא תייג תמונות';
  return n === 1 ? 'חבר אחד בקבוצה תייג תמונות' : `${n} חברים בקבוצה תייגו תמונות`;
}
