import { DEMO_DAY_RUBRIC, scoreRubric } from '../../../lib/ws/deliverables';
import type { JsonObject } from '../../../lib/ws/types';
import { LEVEL_TEXTS } from './rubric-levels';

export type RubricScores = Readonly<Record<string, number>>;

export const RUBRIC_VERSION = DEMO_DAY_RUBRIC.id;
const KNOWN_IDS: ReadonlySet<string> = new Set(DEMO_DAY_RUBRIC.criteria.map((c) => c.id));

export const levelText = (criterionId: string, level: number): string => LEVEL_TEXTS[criterionId]?.[level] ?? '';

function known(scores: RubricScores): RubricScores {
  return Object.fromEntries(Object.entries(scores).filter(([id]) => KNOWN_IDS.has(id)));
}

/** Weighted total out of 100 (unscored criteria count 0). */
export const rubricTotal = (scores: RubricScores): number => scoreRubric(known(scores));

export const isComplete = (scores: RubricScores): boolean =>
  DEMO_DAY_RUBRIC.criteria.every((c) => Number.isInteger(scores[c.id]) && scores[c.id] >= 1);

const isLevel = (v: unknown): v is number =>
  typeof v === 'number' && Number.isInteger(v) && v >= 1 && v <= DEMO_DAY_RUBRIC.maxLevel;

/** extras.rubric.scores, keeping only known criteria with a valid level. */
export function readRubricScores(extras: JsonObject): RubricScores {
  const rubric = extras.rubric;
  if (!rubric || typeof rubric !== 'object') return {};
  const raw = (rubric as { scores?: unknown }).scores;
  if (!raw || typeof raw !== 'object') return {};
  const out: Record<string, number> = {};
  for (const [id, v] of Object.entries(raw as Record<string, unknown>)) {
    if (KNOWN_IDS.has(id) && isLevel(v)) out[id] = v;
  }
  return out;
}

/** New extras object with extras.rubric replaced; every other key is kept. */
export function buildRubricExtras(extras: JsonObject, scores: RubricScores): JsonObject {
  const clean = known(scores);
  return { ...extras, rubric: { version: RUBRIC_VERSION, scores: clean, total: rubricTotal(clean) } };
}

const BANDS: readonly { min: number; label: string }[] = [
  { min: 85, label: 'בהצטיינות' },
  { min: 60, label: 'עמידה בציפיות' },
  { min: 0, label: 'בדרך (המשך חניכה)' },
];

export const scoreBand = (total: number): string => (BANDS.find((b) => total >= b.min) ?? BANDS[BANDS.length - 1]).label;
