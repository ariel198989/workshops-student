import type { StudentProgress } from './context';

/** 50 tagged per class is the floor for training, 150 is a strong set. */
export const MIN_TAGGED = 50;
export const STRONG_TAGGED = 150;

export type ClassLevel = 'red' | 'ok' | 'strong';

export const classLevel = (tagged: number): ClassLevel =>
  tagged >= STRONG_TAGGED ? 'strong' : tagged >= MIN_TAGGED ? 'ok' : 'red';

/** Bar width in percent on the 0..150 scale. */
export const barFill = (tagged: number): number =>
  Math.round(Math.min(Math.max(tagged, 0), STRONG_TAGGED) / STRONG_TAGGED * 100);

export interface NextStep {
  title: string;
  hint: string;
  href: string;
}

const step = (title: string, hint: string, href: string): NextStep => ({ title, hint, href });

const CAPTURE = '/capture';
const TAG = '/tag';
const TRAIN = '/train';
const RESULTS = '/results';

function tagTitle(n: number): string {
  return n === 1 ? 'תייגו תמונה אחת' : `תייגו ${n} תמונות`;
}

function weakestClass(p: StudentProgress): string | null {
  const weakest = [...p.coverage].sort((a, b) => a.tagged - b.tagged)[0];
  return weakest && weakest.tagged < MIN_TAGGED ? weakest.name : null;
}

const readyToTrain = (p: StudentProgress): boolean =>
  p.coverage.length > 0
    ? p.coverage.every((c) => c.tagged >= MIN_TAGGED)
    : p.tagged >= MIN_TAGGED;

/** The one thing the team should do next, picked from the group's progress. Pure. */
export function pickNextStep(p: StudentProgress | null): NextStep {
  if (!p || p.photos === 0) {
    return step('צלמו את האובייקט הראשון', 'כל מודל מתחיל בתמונה אחת', CAPTURE);
  }
  if (p.untagged > 0) {
    return step(tagTitle(p.untagged), 'המודל לומד רק מתמונות שסומנו', TAG);
  }
  if (p.jobs.running > 0) {
    return step('האימון רץ עכשיו', 'אפשר לעקוב אחרי ההתקדמות', TRAIN);
  }
  if (p.model) {
    return step('בדקו את המודל', 'ראו איפה הוא צודק ואיפה הוא טועה', RESULTS);
  }
  if (readyToTrain(p)) {
    return step('אמנו מודל', 'יש מספיק תמונות מתויגות בכל קבוצה', TRAIN);
  }
  const weak = weakestClass(p);
  return weak
    ? step(`צלמו עוד תמונות של ${weak}`, `צריך לפחות ${MIN_TAGGED} תמונות מתויגות לכל קבוצה`, CAPTURE)
    : step('צלמו עוד תמונות', `צריך לפחות ${MIN_TAGGED} תמונות מתויגות`, CAPTURE);
}
