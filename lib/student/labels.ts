// Hebrew copy and small pure helpers for the student area. No Supabase imports, so it is testable in plain Node.
import type { CertificateVariant } from '../ws/certificates';
import type { StudentContext } from './context';

type Session = StudentContext['sessions'][number];

const TASK_LABELS: Readonly<Record<string, string>> = {
  detect: 'זיהוי',
  classify: 'סיווג',
  count: 'ספירה',
};

export const taskTypeLabel = (taskType: string): string => TASK_LABELS[taskType] ?? 'משימה חופשית';

export function firstName(fullName: string | null | undefined): string {
  return (fullName ?? '').trim().split(/\s+/)[0] ?? '';
}

export function groupChip(group: { number: number; display_name: string | null } | null): string {
  if (!group) return '';
  const name = group.display_name?.trim();
  return name ? `קבוצה ${group.number} · ${name}` : `קבוצה ${group.number}`;
}

// ── errors: Hebrew by code, the raw database message is never shown ──
interface RpcErrorLike { code?: string; message?: string }

const GENERIC_ERROR = 'משהו השתבש. נסו שוב בעוד רגע';

const JOIN_ERRORS: Readonly<Record<string, string>> = {
  P0002: 'הקוד לא נמצא או שהסדנה עוד לא נפתחה',
  '22023': 'השם או הקבוצה שנבחרו לא תקינים. בדקו ונסו שוב',
  '23505': 'כבר הצטרפת לקבוצה אחרת. בקשו מהמדריך להעביר אתכם',
};

export const joinErrorMessage = (err: RpcErrorLike | null): string =>
  (err?.code && JOIN_ERRORS[err.code]) || GENERIC_ERROR;

export function signupErrorMessage(err: RpcErrorLike | null): string {
  const msg = (err?.message ?? '').toLowerCase();
  if (msg.includes('already registered')) return 'האימייל הזה כבר רשום. עברו ללשונית הכניסה';
  if (msg.includes('password')) return 'הסיסמה צריכה להכיל לפחות 6 תווים';
  if (msg.includes('invalid') && msg.includes('email')) return 'כתובת האימייל לא תקינה';
  return GENERIC_ERROR;
}

// ── form validation ──
export const MIN_PASSWORD = 6;
const MIN_NAME = 2;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface SignupInput { fullName: string; email: string; password: string }

export function validateJoinName(name: string): string | null {
  return name.trim().length >= MIN_NAME ? null : 'כתבו את השם המלא שלכם';
}

export function validateSignup(input: SignupInput): string | null {
  const nameError = validateJoinName(input.fullName);
  if (nameError) return nameError;
  if (!EMAIL_RE.test(input.email.trim())) return 'כתבו כתובת אימייל תקינה';
  if (input.password.length < MIN_PASSWORD) return `הסיסמה צריכה להכיל לפחות ${MIN_PASSWORD} תווים`;
  return null;
}

// ── schedule ──
const SESSION_DONE = ['done', 'cancelled'];
const WHEN_OPTS: Intl.DateTimeFormatOptions = {
  weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit',
  hour12: false, timeZone: 'Asia/Jerusalem',
};

export function formatSessionWhen(value: string | null): string {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleString('he-IL', WHEN_OPTS);
}

/** Earliest session that is still ahead (or live right now). Unscheduled sessions are skipped. */
export function pickNextSession(sessions: readonly Session[], now: Date): Session | null {
  const open = sessions
    .filter((s) => s.scheduled_at && !SESSION_DONE.includes(s.status))
    .filter((s) => s.status === 'live' || new Date(s.scheduled_at as string).getTime() >= now.getTime())
    .sort((a, b) => new Date(a.scheduled_at as string).getTime() - new Date(b.scheduled_at as string).getTime());
  return open[0] ?? null;
}

// Students never see a demo score, so distinction is not an option for them.
export const certificateVariantFor = (format: string): CertificateVariant =>
  format === 'custom' ? 'corporate' : 'standard';
