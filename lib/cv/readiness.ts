// Pure readiness, queue and model-quality rules for the train and results screens.
// Thresholds mirror Smart City (YOLO is useful from ~50 tagged photos per
// class, strong from ~150) and components/ws/p4/readiness.ts (the staff board).

export type Tier = 'red' | 'ok' | 'strong';
export type JobTone = 'ok' | 'active' | 'wait' | 'off' | 'bad';
export type Verdict = 'unknown' | 'weak' | 'basic' | 'strong';

export const RED_BELOW = 50;
export const STRONG_FROM = 150;
/** Smart City refuses to open a job under this many tagged photos. */
export const MIN_TRAIN_IMAGES = 10;
const WEAK_AP50 = 0.5;
const WEAK_BOXES = 20;

export function classTier(count: number): Tier {
  if (!Number.isFinite(count) || count < RED_BELOW) return 'red';
  return count < STRONG_FROM ? 'ok' : 'strong';
}

export interface CoverageRow {
  name: string;
  count: number;
  tier: Tier;
  /** photos still missing to reach the first (50) target */
  missing: number;
  offTarget: boolean;
}

/** Every target class (even with zero photos), then classes tagged outside the targets. */
export function coverageRows(targets: string[], byClass: { name: string; count: number }[]): CoverageRow[] {
  const counts = new Map(byClass.map((c) => [c.name, c.count]));
  const row = (name: string, offTarget: boolean): CoverageRow => {
    const count = counts.get(name) ?? 0;
    return { name, count, tier: classTier(count), missing: Math.max(0, RED_BELOW - count), offTarget };
  };
  const base = targets.length ? targets : byClass.map((c) => c.name);
  const extra = targets.length ? byClass.map((c) => c.name).filter((n) => !targets.includes(n)) : [];
  return [...base.map((n) => row(n, false)), ...extra.map((n) => row(n, true))];
}

/** The group is only as ready as its weakest target class. */
export function overallTier(rows: CoverageRow[]): Tier {
  const own = rows.filter((r) => !r.offTarget);
  if (!own.length) return 'red';
  if (own.some((r) => r.tier === 'red')) return 'red';
  return own.every((r) => r.tier === 'strong') ? 'strong' : 'ok';
}

export function trainBlockReason(taggedTotal: number, jobActive: boolean): string | null {
  if (jobActive) return 'יש כבר משימת אימון ממתינה או רצה לקבוצה. אפשר לבטל ממתינה כדי לפתוח חדשה.';
  if (taggedTotal <= 0) return 'עוד לא תויגו תמונות. צלמו ותייגו קודם.';
  if (taggedTotal < MIN_TRAIN_IMAGES) {
    return `תויגו רק ${taggedTotal} תמונות. צריך לפחות ${MIN_TRAIN_IMAGES} כדי שהאימון ייצא משהו.`;
  }
  return null;
}

interface QueueJob { id: string; status: string; created_at: string }

/** How many pending jobs (any group) sit ahead of this pending job. null if it is not pending. */
export function queueAhead(all: QueueJob[], jobId: string): number | null {
  const me = all.find((j) => j.id === jobId);
  if (!me || me.status !== 'pending') return null;
  const mine = Date.parse(me.created_at);
  return all.filter((j) => j.status === 'pending' && j.id !== me.id && Date.parse(j.created_at) < mine).length;
}

export function jobTone(status: string): JobTone {
  switch (status) {
    case 'done': return 'ok';
    case 'running': return 'active';
    case 'pending': return 'wait';
    case 'failed': case 'error': return 'bad';
    default: return 'off';
  }
}

export interface ClassStat {
  name: string;
  ap50?: number | null;
  boxes?: number | null;
  /** optional in Smart City's trainer output (0..1); only present when the trainer wrote them */
  precision?: number;
  recall?: number;
  /** confusion counts, when the trainer wrote them */
  tp?: number;
  fp?: number;
  fn?: number;
}

const OPTIONAL_NUMERIC: readonly (keyof ClassStat)[] = ['precision', 'recall', 'tp', 'fp', 'fn'];

/** sc_models.class_stats is free-form jsonb: keep only well-formed {name,...} entries. */
export function parseClassStats(raw: unknown): ClassStat[] {
  if (!Array.isArray(raw)) return [];
  const out: ClassStat[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const r = item as Record<string, unknown>;
    if (typeof r.name !== 'string' || !r.name) continue;
    const extras = OPTIONAL_NUMERIC.reduce<Partial<ClassStat>>(
      (acc, key) => (typeof r[key] === 'number' && Number.isFinite(r[key]) ? { ...acc, [key]: r[key] } : acc), {});
    out.push({
      name: r.name,
      ap50: typeof r.ap50 === 'number' ? r.ap50 : null,
      boxes: typeof r.boxes === 'number' ? r.boxes : null,
      ...extras,
    });
  }
  return out;
}

export function isWeak(s: ClassStat): boolean {
  return (s.ap50 != null && s.ap50 < WEAK_AP50) || (s.boxes != null && s.boxes < WEAK_BOXES);
}

export const weakClasses = (raw: unknown): ClassStat[] => parseClassStats(raw).filter(isWeak);

/** Honest one-word verdict on a model, same cut-offs as Smart City's model card. */
export function modelVerdict(imageCount: number | null, honestVal: boolean | null): Verdict {
  if (imageCount == null) return 'unknown';
  if (imageCount < 30 || honestVal === false) return 'weak';
  return imageCount < 100 ? 'basic' : 'strong';
}

/** accuracy is mAP50 in 0..1; tolerate values already in percent. */
export function accuracyPercent(accuracy: number | null | undefined): number | null {
  if (accuracy == null || !Number.isFinite(accuracy)) return null;
  return Math.round(accuracy <= 1 ? accuracy * 100 : accuracy);
}

/** "waiting for 12 minutes" style label for a job age in milliseconds. */
export function waitLabel(ms: number): string {
  const min = Math.max(0, Math.floor(ms / 60000));
  if (min < 1) return 'פחות מדקה';
  if (min === 1) return 'דקה';
  if (min < 60) return `${min} דקות`;
  const h = Math.floor(min / 60);
  const rest = min % 60;
  const hours = h === 1 ? 'שעה' : `${h} שעות`;
  return rest ? `${hours} ו-${rest} דקות` : hours;
}
