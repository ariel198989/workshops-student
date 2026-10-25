import { sb } from '../db';
import { authedPost } from './staff';
import type { IssueResult, VerifyResult, WsCertificate } from './types';

export async function listCertificates(workshopId: string): Promise<WsCertificate[]> {
  const { data, error } = await sb.from('ws_certificates').select('*')
    .eq('workshop_id', workshopId).order('certificate_no');
  if (error) throw error;
  return data as WsCertificate[];
}

export interface IssueOptions { minAttendance?: number; requireDeliverable?: boolean; participantIds?: string[] }

// Omitted options keep the RPC defaults (0.5 / false / all). Never send null for p_min_attendance.
export async function issueCertificates(workshopId: string, opts: IssueOptions = {}): Promise<IssueResult> {
  const params = {
    p_workshop: workshopId,
    ...(opts.minAttendance !== undefined && { p_min_attendance: opts.minAttendance }),
    ...(opts.requireDeliverable !== undefined && { p_require_deliverable: opts.requireDeliverable }),
    ...(opts.participantIds !== undefined && { p_participant_ids: opts.participantIds }),
  };
  const { data, error } = await sb.rpc('ws_issue_certificates', params);
  if (error) throw error;
  return data as IssueResult;
}

export async function revokeCertificate(id: string, reason: string): Promise<void> {
  const { error } = await sb.rpc('ws_revoke_certificate', { p_certificate: id, p_reason: reason });
  if (error) throw error;
}

// anon-callable; null = unknown / malformed code
export async function verifyCertificate(code: string): Promise<VerifyResult | null> {
  const { data, error } = await sb.rpc('ws_verify_certificate', { p_code: code });
  if (error) throw error;
  return (data as VerifyResult | null) ?? null;
}

export const requestPdf = (certificateId: string): Promise<{ pdf_path: string }> =>
  authedPost<{ pdf_path: string }>(`/api/certificates/${encodeURIComponent(certificateId)}/pdf`);

const SIGNED_URL_TTL_SECONDS = 600;

export async function signedPdfUrl(pdfPath: string): Promise<string> {
  const { data, error } = await sb.storage.from('ws-private').createSignedUrl(pdfPath, SIGNED_URL_TTL_SECONDS);
  if (error) throw error;
  return data.signedUrl;
}

// ── rendering (pure; shared by the preview and the PDF route) ─────────
export interface CertificateData { student: string; workshop: string; date: string; org: string }
export const CERTIFICATE_VARIANTS = ['standard', 'distinction', 'corporate'] as const;
export type CertificateVariant = (typeof CERTIFICATE_VARIANTS)[number];
interface VariantCopy { title: string; lines: readonly string[]; signatures: readonly [string, string] }

// copied from curriculum.json certificate.variants (certificate_he_v1)
const FOOTER = 'מה למדנו: ראייה ממוחשבת · יזמות · עבודת צוות · הצגה · יצירתיות';
const VARIANTS: Record<CertificateVariant, VariantCopy> = {
  standard: {
    title: 'תעודת סיום',
    lines: ['התעודה מוענקת ל', '{{student}}', 'על השתתפות מלאה בסדנה ״{{workshop}}״ מטעם {{org}}.',
      'במהלך הסדנה צוות העבודה צילם ותייג דאטה אמיתי, אימן מודל ראייה ממוחשבת, חיפש את הכשלים שלו והציג פתרון לבעיה של לקוח אמיתי.',
      FOOTER, '{{date}}'],
    signatures: ['מדריך/ה', 'נציג/ת {{org}}'],
  },
  distinction: {
    title: 'תעודת הצטיינות',
    lines: ['התעודה מוענקת ל', '{{student}}', 'על הצטיינות בסדנה ״{{workshop}}״ מטעם {{org}}.',
      'הצוות הציג מודל ראייה ממוחשבת מאומן על דאטה עצמאי, דוח כן על חוזקות וחולשות, והדגמה חיה בפני לקוח אמיתי.',
      FOOTER, '{{date}}'],
    signatures: ['מדריך/ה', 'נציג/ת {{org}}'],
  },
  corporate: {
    title: 'אישור השתתפות',
    lines: ['אישור זה ניתן ל', '{{student}}', 'על השתתפות בסדנה ״{{workshop}}״ ב-{{org}}.',
      'במהלך הסדנה הוגדר מקרה שימוש מהעבודה, נאסף דאטה, אומן מודל ראייה ממוחשבת, נותחו כשלים ונבחנה התאמה לפיילוט.',
      '{{date}}'],
    signatures: ['מנחה', 'נותן/ת החסות'],
  },
};

const ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;', '{': '&#123;', '}': '&#125;' };
const escapeHtml = (s: string): string => s.replace(/[&<>"'{}]/g, (c) => ESCAPES[c]);
// the template already wraps the workshop name in ״...״
const stripOuterQuotes = (s: string): string => s.trim().replace(/^["'״“”]+|["'״“”]+$/g, '').trim();

// single pass: substituted values are never scanned again, so a value cannot inject a placeholder
function fill(template: string, values: CertificateData): string {
  return template.replace(/\{\{(student|workshop|date|org)\}\}/g, (_m, key: keyof CertificateData) => escapeHtml(values[key]));
}

const STYLE = `@page{size:A4 landscape;margin:0}*{box-sizing:border-box}
body{margin:0;font-family:'Rubik','Heebo',sans-serif;color:#0F1C2E;background:#fff}
.cert{width:297mm;height:210mm;padding:16mm 24mm;border:6mm solid #17948C;display:flex;flex-direction:column;align-items:center;justify-content:space-between;text-align:center}
h1{margin:0;font-size:34pt;color:#17948C}.intro{font-size:15pt;color:#334155}
.student{font-size:44pt;font-weight:700}.body{font-size:14pt;line-height:1.6;max-width:210mm;color:#334155}
.date{font-size:13pt;color:#64748B}.sigs{display:flex;gap:40mm;width:100%;justify-content:center}
.sig{border-top:1px solid #64748B;padding-top:2mm;min-width:60mm;font-size:12pt;color:#64748B}`;

function lineHtml(line: string, i: number, last: number, values: CertificateData): string {
  const cls = line === '{{student}}' ? 'student' : i === 0 ? 'intro' : i === last ? 'date' : 'body';
  return `<p class="${cls}">${fill(line, values)}</p>`;
}

export function renderCertificateHtml(data: CertificateData, variant: CertificateVariant): string {
  const copy = VARIANTS[variant] ?? VARIANTS.standard;
  const values = { ...data, workshop: stripOuterQuotes(data.workshop) };
  const last = copy.lines.length - 1;
  const lines = copy.lines.map((l, i) => lineHtml(l, i, last, values)).join('');
  const sigs = copy.signatures.map((s) => `<div class="sig">${fill(s, values)}</div>`).join('');
  return `<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8"><title>${copy.title}</title>`
    + `<style>${STYLE}</style></head><body><div class="cert"><h1>${copy.title}</h1>${lines}`
    + `<div class="sigs">${sigs}</div></div></body></html>`;
}
