// The signed-out student screen, as data: the number keypad is the whole card, the other doors are
// one quiet row of links under it. AuthCard renders from this list, so the order is testable in Node.
export type StudentEntryId = 'number' | 'qr' | 'pin' | 'email';

export interface StudentEntryLink {
  readonly id: Exclude<StudentEntryId, 'number'>;
  readonly label: string;
  /** a sentence shown in place, not a screen (the camera app does the work) */
  readonly explainer?: string;
}

/** The first thing a signed-out child sees. */
export const STUDENT_ENTRY_FIRST: StudentEntryId = 'number';

/** Fallback doors, in the order they appear under the keypad. */
export const STUDENT_ENTRY_LINKS: readonly StudentEntryLink[] = [
  { id: 'qr', label: 'יש לי QR מהמדריך', explainer: 'סרקו אותו עם המצלמה של הטלפון. הוא מכניס אתכם לקבוצה לבד, בלי להקליד.' },
  { id: 'pin', label: 'כניסה עם קוד ו-PIN' },
  { id: 'email', label: 'יש לי חשבון עם אימייל' },
];

/** Everything on the student card, top to bottom. */
export const STUDENT_ENTRY_ORDER: readonly StudentEntryId[] = [STUDENT_ENTRY_FIRST, ...STUDENT_ENTRY_LINKS.map((l) => l.id)];

// ── copy of the number screen ──
export const NUMBER_TITLE = 'מה מספר הסדנה?';
export const NUMBER_SUB = 'המדריך אומר לכם 4 ספרות';
