import type { DemoResult, TaskType } from '../../../lib/ws/types';
import type { InlineOption } from '../InlineEdit';

export const TASK_TYPE_LABELS: Record<TaskType, string> = {
  detect: 'זיהוי',
  classify: 'סיווג',
  count: 'ספירה',
  other: 'אחר',
};

export const DEMO_RESULT_LABELS: Record<DemoResult, string> = {
  pass: 'עבר',
  partial: 'חלקי',
  fail: 'לא עבר',
};

export const toOptions = <K extends string>(labels: Record<K, string>): InlineOption[] =>
  (Object.keys(labels) as K[]).map((value) => ({ value, label: labels[value] }));

export const groupLabel = (g: { number: number; display_name: string | null }): string =>
  g.display_name?.trim() || `קבוצה ${g.number}`;

export const REQUIRED_MSG = 'שדה חובה';

/** InlineEdit values are string | number | null; text columns want string | null. */
export const asText = (v: string | number | null): string | null => (v === null ? null : String(v));

/** For NOT NULL text columns: an empty edit is rejected before it reaches the DB. */
export function requiredText(v: string | number | null): string {
  if (v === null || String(v).trim() === '') throw new Error(REQUIRED_MSG);
  return String(v);
}
