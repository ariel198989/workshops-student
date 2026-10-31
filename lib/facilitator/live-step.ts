// ״שדר לכיתה״: an agenda line becomes the students' live step (ws_set_live_step). Pure, so Node can test
// the mapping; the RPC calls live in ./live-api.ts.

export const LIVE_STEP_KEYS = ['capture', 'tag', 'train', 'results', 'check', 'certificate'] as const;
export type LiveStepKey = (typeof LIVE_STEP_KEYS)[number];

export const BREAK_KEY = 'break';
export const BREAK_LABEL = 'הפסקה';
export const MAX_LABEL = 120;

/** First match wins, in this order: an agenda line "מצלמים ומתייגים" opens the camera first. */
const RULES: readonly { re: RegExp; key: LiveStepKey }[] = [
  { re: /מצלמ/, key: 'capture' },
  { re: /מתייג|מסמנ/, key: 'tag' },
  { re: /אימון|שולח/, key: 'train' },
  { re: /תוצא|ציון/, key: 'results' },
  { re: /שאלון|בדיקת מושגים/, key: 'check' },
  { re: /תעוד/, key: 'certificate' },
];

/** The student screen an agenda line is about; null when the line is talk, demo or discussion. */
export function stepKeyFor(text: string | null | undefined): LiveStepKey | null {
  const t = (text ?? '').trim();
  if (!t) return null;
  return RULES.find((r) => r.re.test(t))?.key ?? null;
}

/** The routes a step opens: the step's own screen; nothing for a step without a screen. */
export const routesFor = (key: LiveStepKey | null): LiveStepKey[] => (key ? [key] : []);

export interface LiveStepArgs {
  p_workshop: string;
  p_session_module: string | null;
  p_step_key: string | null;
  p_label: string | null;
  p_allowed_routes: string[];
  p_message: string | null;
}

const trimLabel = (s: string): string => (s.length > MAX_LABEL ? `${s.slice(0, MAX_LABEL - 1).trimEnd()}…` : s);

/** RPC arguments for one agenda line: key from the text, the line itself as the label. */
export function liveStepArgs(workshopId: string, moduleId: string | null, lineText: string, message: string | null = null): LiveStepArgs {
  const key = stepKeyFor(lineText);
  const label = trimLabel(lineText.trim());
  return {
    p_workshop: workshopId, p_session_module: moduleId, p_step_key: key, p_label: label || null,
    p_allowed_routes: routesFor(key), p_message: message,
  };
}

/** The break: a label, no screens. */
export const breakArgs = (workshopId: string): LiveStepArgs => ({
  p_workshop: workshopId, p_session_module: null, p_step_key: BREAK_KEY, p_label: BREAK_LABEL, p_allowed_routes: [], p_message: null,
});

/** What the facilitator's NowBar shows for the current ws_live_state row; null when nothing is broadcast. */
export function liveLabelOf(row: { label?: unknown; step_key?: unknown } | null | undefined): string | null {
  if (!row) return null;
  if (typeof row.label === 'string' && row.label.trim()) return row.label;
  return typeof row.step_key === 'string' && row.step_key ? row.step_key : null;
}

/** Is this agenda line the one currently on air? Compared by label, which is what the students see. */
export const isOnAir = (liveLabel: string | null, lineText: string): boolean =>
  liveLabel !== null && liveLabel === trimLabel(lineText.trim());
