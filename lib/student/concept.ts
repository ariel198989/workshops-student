// Concept checks (pre/post): pure shapes and helpers. Anonymous by design: nothing here knows who answers.
// The Supabase call lives in concept-api.ts so this file stays testable in plain Node.

export const CHECK_PHASES = ['pre', 'post'] as const;
export type CheckPhase = (typeof CHECK_PHASES)[number];

export interface ConceptQuestion {
  /** optional in the module content; the server keys answers by `id` or, failing that, by the question's index */
  id?: string;
  q: string;
  options: string[];
  /** index of the correct option; null marks an attitude scale (1..5), not a knowledge question */
  answer: number | null;
  core?: string;
  note?: string;
}

export interface ConceptCheck {
  session_module_id: string;
  module_title: string;
  module_slug: string;
  phase_available: 'pre' | 'post' | 'both';
  questions: ConceptQuestion[];
}

export const PHASE_LABEL: Readonly<Record<CheckPhase, string>> = { pre: 'לפני', post: 'אחרי' };

const LETTERS = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ז', 'ח'] as const;
export const SCALE_MAX = 5;

/** The letter shown next to option `i` (א, ב, ג…); beyond the alphabet slice, the number. */
export const optionLetter = (i: number): string => LETTERS[i] ?? String(i + 1);

/** Attitude items carry no correct answer and render a 1..5 scale instead of their options. */
export const isScale = (q: ConceptQuestion): boolean => q.answer === null || q.answer === undefined;

/** The key the server aggregates by: the question's id, else its zero-based index as text. */
export const questionKey = (q: ConceptQuestion, index: number): string => q.id ?? String(index);

/** Phases a check offers, in the order the facilitator runs them. */
export function phasesOf(check: Pick<ConceptCheck, 'phase_available'>): CheckPhase[] {
  if (check.phase_available === 'pre') return ['pre'];
  if (check.phase_available === 'post') return ['post'];
  return ['pre', 'post'];
}

/** Keeps only well-formed questions from the module's free-form jsonb. */
export function normalizeQuestions(raw: unknown): ConceptQuestion[] {
  if (!Array.isArray(raw)) return [];
  const out: ConceptQuestion[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const r = item as Record<string, unknown>;
    if (typeof r.q !== 'string' || !r.q.trim()) continue;
    const options = Array.isArray(r.options) ? r.options.filter((o): o is string => typeof o === 'string') : [];
    const answer = typeof r.answer === 'number' && Number.isInteger(r.answer) ? r.answer : null;
    if (answer !== null && options.length < 2) continue; // a knowledge question needs choices
    out.push({
      ...(typeof r.id === 'string' && r.id ? { id: r.id } : {}),
      q: r.q,
      options,
      answer,
      ...(typeof r.core === 'string' ? { core: r.core } : {}),
      ...(typeof r.note === 'string' ? { note: r.note } : {}),
    });
  }
  return out;
}

export function normalizeChecks(raw: unknown): ConceptCheck[] {
  if (!Array.isArray(raw)) return [];
  const out: ConceptCheck[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const r = item as Record<string, unknown>;
    if (typeof r.session_module_id !== 'string') continue;
    const questions = normalizeQuestions(r.questions);
    if (questions.length === 0) continue;
    const phase = r.phase_available;
    out.push({
      session_module_id: r.session_module_id,
      module_title: typeof r.module_title === 'string' ? r.module_title : 'בדיקת מושגים',
      module_slug: typeof r.module_slug === 'string' ? r.module_slug : '',
      phase_available: phase === 'pre' || phase === 'post' ? phase : 'both',
      questions,
    });
  }
  return out;
}

/** The answers payload: {"<question key>": <option index or scale value>}. Unanswered questions are left out. */
export function buildAnswers(questions: ConceptQuestion[], picks: ReadonlyArray<number | null>): Record<string, number> {
  return questions.reduce<Record<string, number>>((acc, q, i) => {
    const pick = picks[i];
    return pick === null || pick === undefined ? acc : { ...acc, [questionKey(q, i)]: pick };
  }, {});
}

export const isComplete = (questions: ConceptQuestion[], picks: ReadonlyArray<number | null>): boolean =>
  questions.length > 0 && questions.every((_, i) => picks[i] !== null && picks[i] !== undefined);

/** localStorage key that marks a phase as already submitted on this device (the only trace kept). */
export const lockKey = (sessionModuleId: string, phase: CheckPhase): string => `ws_check:${sessionModuleId}:${phase}`;

export const THANKS = 'תודה, התשובות נשמרו בלי שם';

export function submitErrorMessage(err: { code?: string; message?: string } | null): string {
  switch (err?.code) {
    case '42501': return 'אפשר לענות רק כמשתתפים פעילים בסדנה. התחברו מחדש ונסו שוב';
    case 'P0002': return 'הבדיקה הזאת כבר לא פעילה בסדנה';
    case '22023': return 'התשובות לא נשמרו. נסו למלא שוב';
    default: return 'משהו השתבש. נסו שוב בעוד רגע';
  }
}
