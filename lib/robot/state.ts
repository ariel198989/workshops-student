// The robot's reducer: a mood, the line in its bubble, and a "speak now" counter.
// Pure, so useRobot stays a thin wrapper and Node can test every transition.
import {
  lineFor, moodOnEvent, NAMES_CLASS, shouldSpeak, type LineCtx, type Mood, type RobotEvent,
} from './mood.ts';

/** An event face (happy, oops, curious) stays this long before the live mood takes over again. */
export const HOLD_MS = 3500;

export interface RobotState {
  readonly mood: Mood;
  readonly className: string | null;
  readonly line: string;
  /** The live mood observed while an event face was being held. */
  readonly baseline: Mood;
  readonly baselineClass: string | null;
  readonly holdUntil: number;
  readonly lastSpokenAt: number;
  /** Bumps whenever the line should be read aloud; the hook speaks on change. */
  readonly speakId: number;
  readonly seed: number;
}

export type RobotAction =
  | { type: 'mood'; mood: Mood; ctx?: LineCtx; now: number }
  | { type: 'event'; event: RobotEvent; ctx?: LineCtx; now: number }
  | { type: 'release'; now: number };

export const initialRobot = (mood: Mood = 'idle'): RobotState => ({
  mood,
  className: null,
  line: lineFor(mood),
  baseline: mood,
  baselineClass: null,
  holdUntil: 0,
  lastSpokenAt: -Infinity,
  speakId: 0,
  seed: 0,
});

const classFor = (mood: Mood, ctx?: LineCtx): string | null =>
  NAMES_CLASS.includes(mood) && ctx?.className ? ctx.className : null;

const speechKey = (mood: Mood, className: string | null): string => `${mood}:${className ?? ''}`;

function applyMood(s: RobotState, mood: Mood, ctx: LineCtx | undefined, now: number): RobotState {
  const className = classFor(mood, ctx);
  if (mood === s.mood && className === s.className) return s;
  const speak = shouldSpeak(speechKey(s.mood, s.className), speechKey(mood, className), s.lastSpokenAt, now);
  return {
    ...s,
    mood,
    className,
    line: lineFor(mood, { ...ctx, className }, s.seed),
    seed: s.seed + 1,
    lastSpokenAt: speak ? now : s.lastSpokenAt,
    speakId: speak ? s.speakId + 1 : s.speakId,
  };
}

export function robotReducer(s: RobotState, a: RobotAction): RobotState {
  switch (a.type) {
    case 'mood': {
      const baselineClass = classFor(a.mood, a.ctx);
      const base = a.mood === s.baseline && baselineClass === s.baselineClass ? s : { ...s, baseline: a.mood, baselineClass };
      if (a.now < s.holdUntil) return base;
      return applyMood(base, a.mood, a.ctx, a.now);
    }
    case 'event': {
      // events are deliberate presses, so only the time gate applies
      const speak = shouldSpeak(speechKey(s.mood, s.className), `event:${a.event}:${s.seed}`, s.lastSpokenAt, a.now);
      return {
        ...s,
        mood: moodOnEvent(a.event),
        className: null,
        line: lineFor(a.event, a.ctx, s.seed),
        seed: s.seed + 1,
        holdUntil: a.now + HOLD_MS,
        lastSpokenAt: speak ? a.now : s.lastSpokenAt,
        speakId: speak ? s.speakId + 1 : s.speakId,
      };
    }
    case 'release':
      if (a.now < s.holdUntil) return s;
      return applyMood(s, s.baseline, { className: s.baselineClass }, a.now);
  }
}
