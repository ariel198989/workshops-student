import { CERTIFICATE_VARIANTS, type CertificateData, type CertificateVariant } from './certificates';
import type { WorkshopFormat, WsCertificate } from './types';

// Copy of curriculum.json certificate.variants (certificate_he_v1), split into fields so the
// on-screen preview and the print view can lay them out. Texts keep the {{...}} placeholders.
export const CERTIFICATE_VARIANT_LIST = CERTIFICATE_VARIANTS;
export const DISTINCTION_MIN_SCORE = 85;

export interface VariantCopy {
  title: string;
  intro: string;
  summary: string;
  description: string;
  learned: string | null;
  signatures: readonly [string, string];
}

const LEARNED = 'מה למדנו: ראייה ממוחשבת · יזמות · עבודת צוות · הצגה · יצירתיות';

export const VARIANT_COPY: Record<CertificateVariant, VariantCopy> = {
  standard: {
    title: 'תעודת סיום',
    intro: 'התעודה מוענקת ל',
    summary: 'על השתתפות מלאה בסדנה ״{{workshop}}״ מטעם {{org}}.',
    description: 'במהלך הסדנה צוות העבודה צילם ותייג דאטה אמיתי, אימן מודל ראייה ממוחשבת, חיפש את הכשלים שלו והציג פתרון לבעיה של לקוח אמיתי.',
    learned: LEARNED,
    signatures: ['מדריך/ה', 'נציג/ת {{org}}'],
  },
  distinction: {
    title: 'תעודת הצטיינות',
    intro: 'התעודה מוענקת ל',
    summary: 'על הצטיינות בסדנה ״{{workshop}}״ מטעם {{org}}.',
    description: 'הצוות הציג מודל ראייה ממוחשבת מאומן על דאטה עצמאי, דוח כן על חוזקות וחולשות, והדגמה חיה בפני לקוח אמיתי.',
    learned: LEARNED,
    signatures: ['מדריך/ה', 'נציג/ת {{org}}'],
  },
  corporate: {
    title: 'אישור השתתפות',
    intro: 'אישור זה ניתן ל',
    summary: 'על השתתפות בסדנה ״{{workshop}}״ ב-{{org}}.',
    description: 'במהלך הסדנה הוגדר מקרה שימוש מהעבודה, נאסף דאטה, אומן מודל ראייה ממוחשבת, נותחו כשלים ונבחנה התאמה לפיילוט.',
    learned: null,
    signatures: ['מנחה', 'נותן/ת החסות'],
  },
};

export const VARIANT_LABELS: Record<CertificateVariant, string> = {
  standard: 'תעודת סיום',
  distinction: 'הצטיינות',
  corporate: 'אישור השתתפות',
};

const isVariant = (v: unknown): v is CertificateVariant =>
  typeof v === 'string' && (CERTIFICATE_VARIANTS as readonly string[]).includes(v);

export interface PickVariantInput { format: WorkshopFormat; demoScore: number | null; stored?: unknown }

/** Stored choice wins; otherwise corporate for custom workshops, distinction from a score of 85. */
export function pickVariant({ format, demoScore, stored }: PickVariantInput): CertificateVariant {
  if (isVariant(stored)) return stored;
  if (format === 'custom') return 'corporate';
  if (demoScore !== null && demoScore >= DISTINCTION_MIN_SCORE) return 'distinction';
  return 'standard';
}

/** Single pass, so a substituted value is never scanned for placeholders again. */
export function fillTemplate(template: string, values: CertificateData): string {
  return template.replace(/\{\{(student|workshop|date|org)\}\}/g, (_m, key: keyof CertificateData) => values[key]);
}

export const buildVerifyUrl = (origin: string, code: string): string =>
  `${origin.replace(/\/+$/, '')}/verify/${encodeURIComponent(code)}`;

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;
const DATE_OPTS: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long', year: 'numeric' };

/** Date-only strings are formatted as written (no timezone shift); timestamps in Israel time. */
export function formatDateHe(value: string | null | undefined): string {
  if (!value) return '';
  const only = DATE_ONLY.exec(value);
  const date = only ? new Date(Date.UTC(Number(only[1]), Number(only[2]) - 1, Number(only[3]))) : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('he-IL', { ...DATE_OPTS, timeZone: only ? 'UTC' : 'Asia/Jerusalem' });
}

export interface CertificateModel {
  id: string;
  variant: CertificateVariant;
  title: string;
  intro: string;
  student: string;
  summary: string;
  description: string;
  learned: string | null;
  dateText: string;
  signatures: readonly [string, string];
  workshop: string;
  org: string;
  datesRange: string | null;
  hours: number | null;
  groupName: string | null;
  subproblem: string | null;
  certificateNo: string;
  verifyUrl: string;
  revoked: boolean;
}

const str = (v: unknown): string => (typeof v === 'string' ? v : '');
const stripQuotes = (s: string): string => s.trim().replace(/^["'״“”]+|["'״“”]+$/g, '').trim();

function datesRange(data: WsCertificate['data']): string | null {
  const from = formatDateHe(str(data.starts_on));
  const to = formatDateHe(str(data.ends_on));
  if (from && to && from !== to) return `${from} - ${to}`;
  return from || to || null;
}

/** Everything the print layout needs, derived from the certificate row snapshot. Pure. */
export function buildCertificateModel(cert: WsCertificate, variant: CertificateVariant, origin: string): CertificateModel {
  const copy = VARIANT_COPY[variant];
  const values: CertificateData = {
    student: cert.recipient_name,
    workshop: stripQuotes(str(cert.data.workshop_title)),
    org: str(cert.data.organization),
    date: formatDateHe(cert.issued_at),
  };
  const fill = (t: string): string => fillTemplate(t, values);
  const hours = typeof cert.data.hours === 'number' && cert.data.hours > 0 ? cert.data.hours : null;
  return {
    id: cert.id,
    variant,
    title: copy.title,
    intro: copy.intro,
    student: cert.recipient_name,
    summary: fill(copy.summary),
    description: fill(copy.description),
    learned: copy.learned,
    dateText: values.date,
    signatures: [fill(copy.signatures[0]), fill(copy.signatures[1])],
    workshop: values.workshop,
    org: values.org,
    datesRange: datesRange(cert.data),
    hours,
    groupName: cert.group_name,
    subproblem: str(cert.data.subproblem) || null,
    certificateNo: cert.certificate_no,
    verifyUrl: buildVerifyUrl(origin, cert.verify_code),
    revoked: cert.status === 'revoked',
  };
}
