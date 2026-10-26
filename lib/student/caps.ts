// What a student may do in this workshop, by cycle depth. Pure: no React or Supabase, so Node can test it.
// The server derives caps in ws_student_caps(); this file mirrors the derivation only as a fallback for
// contexts that predate the migration (no `caps` key) and normalizes whatever the RPC returns.

export const CYCLE_DEPTHS = ['L0', 'L1', 'L2', 'L3', 'L4'] as const;
export type CycleDepth = (typeof CYCLE_DEPTHS)[number];

export const TAG_MODES = ['none', 'point', 'box'] as const;
export type TagMode = (typeof TAG_MODES)[number];

export const METRIC_MODES = ['yes_no', 'x_of_10', 'score_1_10', 'model_score', 'map_pr'] as const;
export type MetricMode = (typeof METRIC_MODES)[number];

export interface StudentCaps {
  readonly can_capture: boolean;
  readonly can_tag: boolean;
  readonly tag_mode: TagMode;
  readonly can_train: boolean;
  readonly can_view_model: boolean;
  readonly metric_mode: MetricMode;
}

const CAPS_BY_DEPTH: Readonly<Record<CycleDepth, StudentCaps>> = {
  L0: { can_capture: false, can_tag: false, tag_mode: 'none', can_train: false, can_view_model: false, metric_mode: 'yes_no' },
  L1: { can_capture: true, can_tag: false, tag_mode: 'none', can_train: false, can_view_model: false, metric_mode: 'x_of_10' },
  L2: { can_capture: true, can_tag: true, tag_mode: 'point', can_train: false, can_view_model: true, metric_mode: 'score_1_10' },
  L3: { can_capture: true, can_tag: true, tag_mode: 'box', can_train: true, can_view_model: true, metric_mode: 'model_score' },
  L4: { can_capture: true, can_tag: true, tag_mode: 'box', can_train: true, can_view_model: true, metric_mode: 'map_pr' },
};

/** Before the migration every workshop ran the full cycle, so a context without caps behaves as L3. */
export const DEFAULT_DEPTH: CycleDepth = 'L3';
export const DEFAULT_CAPS: StudentCaps = CAPS_BY_DEPTH[DEFAULT_DEPTH];

const isDepth = (v: unknown): v is CycleDepth => typeof v === 'string' && (CYCLE_DEPTHS as readonly string[]).includes(v);
const isTagMode = (v: unknown): v is TagMode => typeof v === 'string' && (TAG_MODES as readonly string[]).includes(v);
const isMetricMode = (v: unknown): v is MetricMode =>
  typeof v === 'string' && (METRIC_MODES as readonly string[]).includes(v);

/** Caps the server would derive for a depth (device mode ignored: the server already applied it when caps exist). */
export const capsForDepth = (depth: unknown): StudentCaps => CAPS_BY_DEPTH[isDepth(depth) ? depth : DEFAULT_DEPTH];

/**
 * Normalizes the `caps` object of ws_my_context(). Missing object → derived from `depth` (L3 when that is
 * missing too). Individual malformed fields fall back to the derived value, so a partial payload never breaks the app.
 */
export function normalizeCaps(raw: unknown, depth: unknown = undefined): StudentCaps {
  const base = capsForDepth(depth);
  if (!raw || typeof raw !== 'object') return base;
  const r = raw as Record<string, unknown>;
  const bool = (key: keyof StudentCaps, fallback: boolean) => (typeof r[key] === 'boolean' ? (r[key] as boolean) : fallback);
  const tagMode = isTagMode(r.tag_mode) ? r.tag_mode : base.tag_mode;
  const canTag = bool('can_tag', base.can_tag) && tagMode !== 'none';
  return {
    can_capture: bool('can_capture', base.can_capture),
    can_tag: canTag,
    tag_mode: canTag ? tagMode : 'none',
    can_train: bool('can_train', base.can_train),
    can_view_model: bool('can_view_model', base.can_view_model),
    metric_mode: isMetricMode(r.metric_mode) ? r.metric_mode : base.metric_mode,
  };
}

/** True for the "students only shoot" workshops: photos go to the gallery, the facilitator does the rest. */
export const isCaptureOnly = (caps: StudentCaps): boolean =>
  caps.can_capture && !caps.can_tag && !caps.can_train && !caps.can_view_model;
