// רובי, the robot the class teaches. Pure rules: which face to pull, which
// short Hebrew line to say, and when speaking is allowed. No React, no DOM, so
// Node can test it. Lines are picked by a seed so the output is deterministic.
import { SURE_FROM, UNSURE_FROM } from '../pocket/score.ts';

export type Mood = 'sleep' | 'idle' | 'curious' | 'thinking' | 'sure' | 'unsure' | 'lost' | 'happy' | 'oops';
export type RobotEvent = 'shot' | 'learned' | 'reset' | 'right' | 'wrong' | 'class_added';
export type LineKey = Mood | RobotEvent;

export interface LineCtx { className?: string | null; count?: number; k?: number }

/** One spoken line per 4s at most; the bubble itself is never rate-limited. */
export const SPEAK_GAP_MS = 4000;

/** Frozen frames mean "the class is guessing", so the robot visibly thinks. */
export function moodFromPrediction(pred: { confidence: number } | null, frozen: boolean): Mood {
  if (frozen) return 'thinking';
  if (!pred) return 'lost';
  if (pred.confidence >= SURE_FROM) return 'sure';
  if (pred.confidence >= UNSURE_FROM) return 'unsure';
  return 'lost';
}

const EVENT_MOOD: Record<RobotEvent, Mood> = {
  shot: 'curious',
  learned: 'happy',
  reset: 'sleep',
  right: 'happy',
  wrong: 'oops',
  class_added: 'curious',
};

export const moodOnEvent = (event: RobotEvent): Mood => EVENT_MOOD[event];

/** Moods whose line names the class; every other mood ignores it. */
export const NAMES_CLASS: readonly Mood[] = ['sure', 'unsure'];

const LINES: Record<LineKey, readonly string[]> = {
  sleep: ['אני ישן. תעירו אותי כשיש מה ללמוד', 'עוד אין לי מה ללמוד. מישהו?'],
  idle: ['אני רובי. תלמדו אותי משהו?', 'מחכה לתמונות שלכם', 'מה נלמד היום?'],
  curious: ['מה זה? תראו לי עוד', 'מעניין! עוד זווית?', 'אני מסתכל…'],
  thinking: ['רגע, אני חושב…', 'הממ… מה זה יכול להיות?', 'תנו לי שנייה לחשוב'],
  sure: ['זה {className}, אני בטוח', 'ברור! זה {className}', '{className}! בטוח בזה'],
  unsure: ['אני חושב ש… {className}? לא בטוח', 'אולי {className}? לא לגמרי בטוח', 'הממ, {className}? אני מתלבט'],
  lost: ['את זה עוד לא לימדתם אותי', 'אני לא מכיר את זה', 'מה זה? זה חדש לי'],
  happy: ['יש!', 'איזה כיף!', 'הצלחנו!'],
  oops: ['אופס…', 'טעות שלי', 'אוי, לא יצא לי'],
  shot: ['עוד אחת! אני אוסף דוגמאות', 'קליק! עוד תמונה אצלי', 'תודה! עוד אחת?'],
  learned: ['יש! למדתי {count} תמונות של {className}', 'עכשיו אני מכיר {className} יותר טוב', 'למדתי {count} תמונות חדשות'],
  reset: ['שכחתי הכול. מתחילים מחדש', 'מחקתי הכול. מי מלמד אותי עכשיו?'],
  right: ['צדקתי!', 'יש! צדקתי', 'ידעתי!'],
  wrong: ['טעיתי. תראו לי עוד דוגמאות?', 'אופס, טעיתי. עוד תמונות יעזרו לי', 'לא נורא, אני עוד לומד'],
  class_added: ['{className}? מה זה? תראו לי', 'מחלקה חדשה: {className}. אני סקרן', 'אשמח ללמוד מה זה {className}'],
};

const FALLBACK: Record<keyof LineCtx, string> = { className: 'משהו', count: 'כמה', k: 'כמה' };

/** "כוס", "כוס ונעל", "כוס, נעל וספר" */
export function joinHe(names: readonly string[]): string {
  const list = names.filter((n) => n.trim().length > 0);
  if (list.length === 0) return '';
  if (list.length === 1) return list[0];
  return `${list.slice(0, -1).join(', ')} ו${list[list.length - 1]}`;
}

/** Deterministic: the same key + seed always gives the same line. Seed 0 is the canonical line. */
export function lineFor(key: LineKey, ctx: LineCtx = {}, seed = 0): string {
  const pool = LINES[key];
  const idx = ((Math.trunc(seed) % pool.length) + pool.length) % pool.length;
  return pool[idx].replace(/\{(className|count|k)\}/g, (_, name: keyof LineCtx) => {
    const v = ctx[name];
    return v === undefined || v === null || v === '' ? FALLBACK[name] : String(v);
  });
}

/**
 * Speak only when the state actually changed and at most once per SPEAK_GAP_MS.
 * `prev`/`next` are moods, or any speech key the caller wants compared.
 */
export function shouldSpeak(prevMood: string, nextMood: string, lastSpokenAt: number, now: number, gapMs = SPEAK_GAP_MS): boolean {
  if (prevMood === nextMood) return false;
  return now - lastSpokenAt >= gapMs;
}

export type LightTone = 'teal' | 'amber' | 'red' | 'off';

/** The antenna light mirrors the confidence bar: teal sure, amber unsure, red lost. */
export function lightTone(mood: Mood): LightTone {
  switch (mood) {
    case 'sure':
    case 'happy':
      return 'teal';
    case 'unsure':
    case 'thinking':
      return 'amber';
    case 'lost':
    case 'oops':
      return 'red';
    default:
      return 'off';
  }
}
