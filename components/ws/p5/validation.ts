// Pure input helpers for the problems and deliverables screens (no React, unit tested).

export function isHttpsUrl(value: string): boolean {
  try {
    const url = new URL(value.trim());
    return url.protocol === 'https:' && url.hostname.length > 0;
  } catch {
    return false;
  }
}

export type PercentResult = { readonly ok: true; readonly value: number | null } | { readonly ok: false };

/** "60" -> 0.6 (target_accuracy is numeric(4,3) between 0 and 1). Empty saves null. */
export function parsePercent(raw: string): PercentResult {
  const text = raw.trim();
  if (text === '') return { ok: true, value: null };
  const n = Number(text);
  if (!Number.isFinite(n) || n < 0 || n > 100) return { ok: false };
  return { ok: true, value: Math.round(n * 10) / 1000 };
}

export const toPercent = (fraction: number | null): number | null =>
  fraction === null || fraction === undefined ? null : Math.round(fraction * 100);

// ── failure cases (ws_deliverables.failure_cases jsonb) ───────────────
export const FAILURE_KINDS = ['fn', 'fp', 'confusion'] as const;
export type FailureKind = (typeof FAILURE_KINDS)[number];
export interface FailureCase { frame_path: string; note: string; kind: FailureKind }

export const FAILURE_KIND_LABELS: Record<FailureKind, string> = {
  fn: 'פספוס',
  fp: 'זיהוי שגוי',
  confusion: 'בלבול בין מחלקות',
};

const isKind = (v: unknown): v is FailureKind => typeof v === 'string' && (FAILURE_KINDS as readonly string[]).includes(v);

export function readFailureCases(raw: readonly unknown[]): FailureCase[] {
  const out: FailureCase[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const { frame_path, note, kind } = item as Record<string, unknown>;
    if (typeof frame_path !== 'string' || !frame_path) continue;
    out.push({ frame_path, note: typeof note === 'string' ? note : '', kind: isKind(kind) ? kind : 'confusion' });
  }
  return out;
}

// ── errors ────────────────────────────────────────────────────────────
const GENERIC = 'הפעולה נכשלה';

function messageOf(err: unknown): { message: string; code: string } {
  if (err instanceof Error) return { message: err.message, code: '' };
  if (err && typeof err === 'object') {
    const { message, code } = err as { message?: unknown; code?: unknown };
    return { message: typeof message === 'string' ? message : '', code: typeof code === 'string' ? code : '' };
  }
  return { message: '', code: '' };
}

/** Short Hebrew text for the common Postgres/RLS failures; unknown errors get a generic line. */
export function hebrewDbError(err: unknown): string {
  const { message, code } = messageOf(err);
  const text = message.toLowerCase();
  if (code === '42501' || text.includes('permission denied') || text.includes('not authorized') || text.includes('row-level security')) {
    return 'אין הרשאה לפעולה הזו';
  }
  if (code === '23514' || text.includes('check constraint')) return 'ערך לא תקין, בדקו את השדות';
  if (code === '23505') return 'הערך כבר קיים';
  if (code === '23502') return 'חסר שדה חובה';
  if (code === 'P0002') return 'הרשומה לא נמצאה';
  if (text.includes('locked') || text.includes('frozen')) return 'התוצר נעול ולא ניתן לעריכה';
  if (text.includes('failed to fetch') || text.includes('network')) return 'בעיית רשת, נסו שוב';
  return GENERIC;
}
