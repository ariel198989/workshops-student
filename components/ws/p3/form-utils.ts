// Pure validation for the new-workshop form. Keys of the result are the field names the form highlights.
import { validateCode, validateTeamPrefix } from './workshop-utils';

export interface WorkshopFormValues {
  orgId: string;
  title: string;
  code: string;
  prefix: string;
  startsOn: string;
  endsOn: string;
  audience: string;
  groupSize: string;
}

export const TITLE_MIN = 2;
export const TITLE_MAX = 160;

function intInRange(raw: string, lo: number, hi: number): boolean {
  const n = Number(raw);
  return Number.isInteger(n) && n >= lo && n <= hi;
}

export function validateWorkshopForm(v: WorkshopFormValues): Record<string, string> {
  const errors: Record<string, string> = {};
  const title = v.title.trim();
  if (!v.orgId) errors.org = 'יש לבחור ארגון';
  if (title.length < TITLE_MIN || title.length > TITLE_MAX) errors.title = `כותרת: ${TITLE_MIN} עד ${TITLE_MAX} תווים`;
  const codeError = validateCode(v.code);
  if (codeError) errors.code = codeError;
  const prefixError = validateTeamPrefix(v.prefix);
  if (prefixError) errors.prefix = prefixError;
  if (v.startsOn && v.endsOn && v.endsOn < v.startsOn) errors.endsOn = 'תאריך הסיום לפני ההתחלה';
  if (v.audience.trim() !== '' && !intInRange(v.audience, 1, 500)) errors.audience = 'מספר בין 1 ל-500';
  if (!intInRange(v.groupSize, 2, 8)) errors.groupSize = 'גודל קבוצה בין 2 ל-8';
  return errors;
}
