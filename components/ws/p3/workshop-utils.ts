// Pure helpers for the workshop create form, list and status bar (no React, unit tested).
import type { WorkshopFormat, WorkshopStatus } from '../../../lib/ws/types';

// ── code ──────────────────────────────────────────────────────────────
export const CODE_MIN = 3;
export const CODE_MAX = 20;
const CODE_PATTERN = /^[A-Z0-9][A-Z0-9-]{2,19}$/;
export const CODE_RULE = 'קוד: 3 עד 20 תווים, A-Z, 0-9 ומקף, מתחיל באות או ספרה';

/** Uppercase, keep A-Z 0-9 and dash only, cap at the DB maximum. */
export function normalizeCode(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, CODE_MAX);
}

export const validateCode = (code: string): string | null => (CODE_PATTERN.test(code) ? null : CODE_RULE);

/** ORG-YYMM from the first latin word of the org name and the start date. Always a valid code. */
export function suggestCode(orgName: string | null | undefined, startsOn: string | null | undefined): string {
  const word = (orgName ?? '').match(/[A-Za-z0-9]+/)?.[0] ?? '';
  const head = normalizeCode(word).slice(0, 8) || 'WS';
  const m = /^(\d{4})-(\d{2})-\d{2}/.exec(startsOn ?? '');
  const tail = m ? `${m[1].slice(2)}${m[2]}` : 'NEW';
  const code = `${head}-${tail}`;
  return code.length >= CODE_MIN ? code : `${code}-WS`;
}

// ── team prefix ───────────────────────────────────────────────────────
export const PREFIX_MIN = 2;
export const PREFIX_MAX = 24;
export const FORBIDDEN_PREFIX_CHARS: readonly string[] = [',', '(', ')', '"', "'", '\\'];
const PERSONAL_MARKER = 'אישי';

/** Client mirror of the ws_workshops.team_prefix check constraint; the DB stays the authority. */
export function validateTeamPrefix(raw: string): string | null {
  const text = raw.trim();
  if (text === '') return 'יש להזין קידומת קבוצה';
  if (text.length < PREFIX_MIN) return `הקידומת קצרה מדי, לפחות ${PREFIX_MIN} תווים`;
  if (text.length > PREFIX_MAX) return `הקידומת ארוכה מדי, עד ${PREFIX_MAX} תווים`;
  if (text.startsWith(PERSONAL_MARKER)) return `הקידומת לא יכולה להתחיל ב${PERSONAL_MARKER}`;
  const bad = FORBIDDEN_PREFIX_CHARS.find((ch) => text.includes(ch));
  if (bad) return bad === '"' ? 'התו " אסור בקידומת, השתמשו בגרשיים ״' : `התו ${bad} אסור בקידומת`;
  return null;
}

export const teamNamePreview = (prefix: string, n = 1): string => `${prefix.trim()} · קבוצה ${n}`;

// ── template and first session ────────────────────────────────────────
interface TemplateLike { id: string; format: string; is_default: boolean }

export function pickDefaultTemplate<T extends TemplateLike>(templates: readonly T[], format: WorkshopFormat): T | null {
  const ofFormat = templates.filter((t) => t.format === format);
  return ofFormat.find((t) => t.is_default) ?? ofFormat[0] ?? null;
}

const FIRST_SESSION_HOUR = 16;

/** Start date at 16:00 browser-local time as an ISO instant (the RPC takes timestamptz). */
export function firstSessionIso(startsOn: string | null | undefined): string | null {
  if (!startsOn || !/^\d{4}-\d{2}-\d{2}$/.test(startsOn)) return null;
  const d = new Date(`${startsOn}T${FIRST_SESSION_HOUR}:00:00`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

// ── status transitions (plan B, restricted to what ws_set_workshop_status accepts) ──
export interface StatusAction {
  to: WorkshopStatus;
  label: string;
  confirm: string;
  tone: 'default' | 'primary' | 'danger';
  adminOnly: boolean;
}

const act = (
  to: WorkshopStatus, label: string, confirm: string,
  tone: StatusAction['tone'] = 'default', adminOnly = false,
): StatusAction => ({ to, label, confirm, tone, adminOnly });

const CANCEL = act('cancelled', 'ביטול הסדנה', 'לבטל את הסדנה?', 'danger', true);

const TRANSITIONS: Record<WorkshopStatus, readonly StatusAction[]> = {
  draft: [act('proposal', 'העברה להצעה', 'להעביר להצעה?'), act('confirmed', 'אישור הסדנה', 'לאשר את הסדנה?'), CANCEL],
  proposal: [act('confirmed', 'אישור הסדנה', 'לאשר את הסדנה?'), CANCEL],
  confirmed: [
    act('live', 'פתיחת הסדנה', 'פתיחת הסדנה יוצרת את הקבוצות באפליקציית Smart City ומציגה אותן בהרשמה', 'primary'),
    CANCEL,
  ],
  live: [act('completed', 'סיום הסדנה', 'הקבוצות יוסתרו מההרשמה, הנתונים נשמרים', 'primary')],
  completed: [act('archived', 'העברה לארכיון', 'להעביר לארכיון?', 'default', true)],
  archived: [],
  cancelled: [act('draft', 'שחזור לטיוטה', 'לשחזר לטיוטה?', 'default', true)],
};

export function statusActions(status: WorkshopStatus, admin: boolean): StatusAction[] {
  return TRANSITIONS[status].filter((a) => admin || !a.adminOnly);
}

// ── list ordering ─────────────────────────────────────────────────────
const RANK: Record<WorkshopStatus, number> = {
  live: 0, confirmed: 1, proposal: 2, draft: 3, completed: 4, archived: 5, cancelled: 5,
};

export const statusRank = (status: string): number => RANK[status as WorkshopStatus] ?? 6;

/** live, confirmed, proposal, draft, completed, then archived/cancelled; newest start first inside a group. */
export function sortWorkshops<T extends { status: string; starts_on: string | null }>(rows: readonly T[]): T[] {
  return rows
    .map((row, index) => ({ row, index }))
    .sort((a, b) => {
      const byStatus = statusRank(a.row.status) - statusRank(b.row.status);
      if (byStatus !== 0) return byStatus;
      const sa = a.row.starts_on ?? '';
      const sb = b.row.starts_on ?? '';
      if (sa !== sb) return sa < sb ? 1 : -1;
      return a.index - b.index;
    })
    .map((x) => x.row);
}

/** 'YYYY-MM-DD' -> 'DD/MM/YYYY'; anything else renders empty. */
export function fmtDay(iso: string | null | undefined): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? '');
  return m ? `${m[3]}/${m[2]}/${m[1]}` : '';
}
