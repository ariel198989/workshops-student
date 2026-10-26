import { DEFAULT_CAPS, type StudentCaps } from './caps.ts';
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

const HOME = '/';
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

/** The facilitator runs this part; the students watch the big screen. */
const WAIT_FOR_TRAINING = step('מחכים למדריך שיאמן', 'התמונות שלכם בגלריה של הקבוצה. המדריך מאמן ומראה את התוצאה על המסך', HOME);
const WATCH_SCREEN = step('המדריך מוביל את הפעילות', 'עוקבים אחרי המסך הגדול', HOME);
const FACILITATOR_SHOWS_RESULT = step('המדריך מראה את התוצאה', 'המודל מוכן. התוצאה מוצגת על המסך', HOME);

function captureMore(p: StudentProgress): NextStep {
  const weak = weakestClass(p);
  return weak
    ? step(`צלמו עוד תמונות של ${weak}`, `צריך לפחות ${MIN_TAGGED} תמונות מתויגות לכל קבוצה`, CAPTURE)
    : step('צלמו עוד תמונות', `צריך לפחות ${MIN_TAGGED} תמונות מתויגות`, CAPTURE);
}

/** Capture-only workshops (L1): students shoot, the facilitator tags, trains and shows. */
function captureOnlyStep(p: StudentProgress): NextStep {
  if (p.model || p.jobs.running > 0) return WAIT_FOR_TRAINING;
  if (p.photos >= MIN_TAGGED) return WAIT_FOR_TRAINING;
  return step('צלמו עוד תמונות', `עד ${MIN_TAGGED} תמונות המדריך יכול להתחיל לאמן`, CAPTURE);
}

/** The one thing the team should do next, picked from the group's progress and what this workshop lets students do. Pure. */
export function pickNextStep(p: StudentProgress | null, caps: StudentCaps = DEFAULT_CAPS): NextStep {
  if (!caps.can_capture) return WATCH_SCREEN;
  if (!p || p.photos === 0) {
    return step('צלמו את האובייקט הראשון', 'כל מודל מתחיל בתמונה אחת', CAPTURE);
  }
  if (!caps.can_tag) return captureOnlyStep(p);
  if (p.untagged > 0) {
    return step(tagTitle(p.untagged), 'המודל לומד רק מתמונות שסומנו', TAG);
  }
  if (p.jobs.running > 0) {
    return caps.can_train
      ? step('האימון רץ עכשיו', 'אפשר לעקוב אחרי ההתקדמות', TRAIN)
      : step('האימון רץ עכשיו', 'המדריך הגיש את התמונות לאימון', caps.can_view_model ? RESULTS : HOME);
  }
  if (p.model) {
    return caps.can_view_model
      ? step('בדקו את המודל', 'ראו איפה הוא צודק ואיפה הוא טועה', RESULTS)
      : FACILITATOR_SHOWS_RESULT;
  }
  if (readyToTrain(p)) {
    return caps.can_train
      ? step('אמנו מודל', 'יש מספיק תמונות מתויגות בכל קבוצה', TRAIN)
      : step('המדריך מגיש לאימון', 'יש מספיק תמונות מתויגות. עכשיו תור המדריך', HOME);
  }
  return captureMore(p);
}
