// Pure rules for the facilitator trainer: confidence bar colour, the "X מתוך 10"
// tally, the kNN k rule and the traffic-light debounce. No tfjs, no React, so
// Node can test it.

export const SURE_FROM = 0.8;
export const UNSURE_FROM = 0.5;
export const TALLY_SIZE = 10;
export const LIGHT_HOLD_MS = 1500;
export const K_MIN = 2;
export const K_MAX = 8;
export const MAX_CLASSES = 3;
export const RECOMMENDED_PER_CLASS = 10;

export type BarLevel = 'green' | 'yellow' | 'red';

/** The only loud element on the screen: green = sure, yellow = unsure, red = does not know. */
export function barLevel(confidence: number): BarLevel {
  if (confidence >= SURE_FROM) return 'green';
  if (confidence >= UNSURE_FROM) return 'yellow';
  return 'red';
}

export const CONFIDENCE_WORDS: Record<BarLevel, string> = {
  green: 'בטוח',
  yellow: 'לא בטוח',
  red: 'לא מכיר',
};

export const confidenceWord = (confidence: number): string => CONFIDENCE_WORDS[barLevel(confidence)];

/**
 * k derived from the SMALLEST class that has examples. An unbalanced dataset
 * must not get a built-in majority vote (Smart City's "everything is a TV
 * remote" bug). Classes with zero examples do not count.
 */
export function kFor(counts: Record<string, number>): number {
  const present = Object.values(counts).filter((n) => n > 0);
  if (present.length === 0) return K_MIN;
  return Math.max(K_MIN, Math.min(K_MAX, Math.min(...present) * 2));
}

/** A model can answer once at least two classes have examples. */
export const canClassify = (counts: Record<string, number>): boolean =>
  Object.values(counts).filter((n) => n > 0).length >= 2;

export type TallyCell = boolean;

export interface Tally { readonly cells: readonly TallyCell[] }

export const emptyTally = (): Tally => ({ cells: [] });

/** Facilitator pressed "צדק" (true) or "טעה" (false); the sheet stops at 10 cells. */
export function recordResult(t: Tally, correct: boolean): Tally {
  if (t.cells.length >= TALLY_SIZE) return t;
  return { cells: [...t.cells, correct] };
}

export const tallyCorrect = (t: Tally): number => t.cells.filter(Boolean).length;
export const tallyFull = (t: Tally): boolean => t.cells.length >= TALLY_SIZE;

/** Shown as plain words, never a percentage. */
export const tallyLabel = (t: Tally): string => `${tallyCorrect(t)} מתוך ${TALLY_SIZE}`;

export type LightColour = 'green' | 'red';
export type LightState = LightColour | 'off';

export interface LightRule { className: string; colour: LightColour }

/** Default rules: the first class turns the light green, the rest red. */
export function defaultRules(classes: readonly string[]): LightRule[] {
  return classes.map((className, i) => ({ className, colour: i === 0 ? 'green' : 'red' }));
}

export function toggleRule(rules: readonly LightRule[], className: string): LightRule[] {
  return rules.map((r) => (r.className === className ? { ...r, colour: r.colour === 'green' ? 'red' : 'green' } : r));
}

/** What a confident prediction asks the light to show; unsure or unknown asks nothing. */
export function ruleTarget(rules: readonly LightRule[], label: string | null, confidence: number): LightState | null {
  if (!label || barLevel(confidence) === 'red') return null;
  return rules.find((r) => r.className === label)?.colour ?? null;
}

export interface LightDebounce {
  readonly shown: LightState;
  readonly candidate: LightState | null;
  readonly candidateSince: number;
}

export const initialLight = (): LightDebounce => ({ shown: 'off', candidate: null, candidateSince: 0 });

/**
 * The light changes only after the same target has been seen for `holdMs`
 * (1.5s) without interruption, so a flickering prediction cannot flicker the
 * light. A null target (unsure) clears the pending candidate but keeps what is
 * shown, so a brief wobble never turns the light off.
 */
export function lightStep(s: LightDebounce, target: LightState | null, now: number, holdMs = LIGHT_HOLD_MS): LightDebounce {
  if (target === null) return s.candidate === null ? s : { ...s, candidate: null, candidateSince: 0 };
  if (target === s.shown) return s.candidate === null ? s : { ...s, candidate: null, candidateSince: 0 };
  if (target !== s.candidate) return { ...s, candidate: target, candidateSince: now };
  if (now - s.candidateSince >= holdMs) return { shown: target, candidate: null, candidateSince: 0 };
  return s;
}

/** Big dots under a class: filled up to `count`, capped at the recommended ten. */
export function dotStates(count: number, total = RECOMMENDED_PER_CLASS): boolean[] {
  return Array.from({ length: total }, (_, i) => i < count);
}

export type NameCheck = { ok: true; name: string } | { ok: false; reason: string };

/** Class chips: short, unique, no quotes; at most three classes. */
export function checkNewClass(raw: string, existing: readonly string[]): NameCheck {
  const name = raw.trim();
  if (!name) return { ok: false, reason: 'כתבו שם למחלקה.' };
  if (name.length > 20) return { ok: false, reason: 'שם קצר יותר, עד 20 תווים.' };
  if (/['"\r\n]/.test(name)) return { ok: false, reason: 'בלי גרשיים בשם.' };
  if (existing.includes(name)) return { ok: false, reason: 'המחלקה הזאת כבר קיימת.' };
  if (existing.length >= MAX_CLASSES) return { ok: false, reason: `עד ${MAX_CLASSES} מחלקות.` };
  return { ok: true, name };
}

/** Gallery import: newest first, at most `cap` frames per class, only the wanted classes. */
export function capPerClass<T extends { class_name: string }>(rows: readonly T[], wanted: readonly string[], cap: number): T[] {
  const seen: Record<string, number> = {};
  const out: T[] = [];
  for (const r of rows) {
    if (!wanted.includes(r.class_name)) continue;
    const n = seen[r.class_name] ?? 0;
    if (n >= cap) continue;
    seen[r.class_name] = n + 1;
    out.push(r);
  }
  return out;
}
