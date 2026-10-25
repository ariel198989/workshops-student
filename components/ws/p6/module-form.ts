// Pure helpers behind ModuleEditor: normalising jsonb content, drafts <-> DB input, validation, list edits.
import type { ModuleInput } from '@/lib/ws/curriculum';
import type { JsonObject, ModuleType, WsModule } from '@/lib/ws/types';

export type Exercise = { title: string; instructions: string; kind: string; tool_hook: string } & Record<string, unknown>;
export interface Question { q: string; options: string[]; /** index of the correct option, -1 when unknown */ answer: number }
export type Material = { label: string; kind: string } & Record<string, unknown>;

export interface ModuleDraft {
  title: string; summary: string; module_type: ModuleType; pipeline_stage: string; duration_minutes: number;
  objectives: string[]; exercises: Exercise[]; materials: Material[]; facilitator_notes: string;
  tags: string[]; requires_app: boolean;
}

export const TITLE_MIN = 2;
export const TITLE_MAX = 120;
export const DURATION_MIN = 5;
export const DURATION_MAX = 720;
const DEFAULT_DURATION = 45;
const COPY_SUFFIX = ' (עותק)';

const isObject = (v: unknown): v is JsonObject => typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (v: unknown): string => (typeof v === 'string' ? v : '');

export function readExercises(raw: readonly unknown[]): Exercise[] {
  return raw.filter(isObject).map((x) => ({
    ...x,
    title: str(x.title), instructions: str(x.instructions),
    kind: str(x.kind) || 'group', tool_hook: str(x.tool_hook) || 'none',
  }));
}

export function readQuestions(raw: unknown): Question[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(isObject).flatMap((x) => {
    if (typeof x.q !== 'string' || !Array.isArray(x.options)) return [];
    const options = x.options.filter((o): o is string => typeof o === 'string');
    const a = typeof x.answer === 'number' && Number.isInteger(x.answer) ? x.answer : -1;
    return [{ q: x.q, options, answer: a >= 0 && a < options.length ? a : -1 }];
  });
}

export function readMaterials(raw: readonly unknown[]): Material[] {
  return raw.filter(isObject).flatMap((x) =>
    str(x.label) ? [{ ...x, label: str(x.label), kind: str(x.kind) || 'handout' }] : []);
}

export const emptyDraft = (): ModuleDraft => ({
  title: '', summary: '', module_type: 'practice', pipeline_stage: '', duration_minutes: DEFAULT_DURATION,
  objectives: [], exercises: [], materials: [], facilitator_notes: '', tags: [], requires_app: false,
});

export const draftFromModule = (m: WsModule): ModuleDraft => ({
  title: m.title, summary: m.summary ?? '', module_type: m.module_type, pipeline_stage: m.pipeline_stage ?? '',
  duration_minutes: m.duration_minutes, objectives: [...m.objectives], exercises: readExercises(m.exercises),
  materials: readMaterials(m.materials), facilitator_notes: m.facilitator_notes ?? '', tags: [...m.tags],
  requires_app: m.requires_app,
});

export function validateDraft(d: ModuleDraft): string | null {
  const len = d.title.trim().length;
  if (len < TITLE_MIN || len > TITLE_MAX) return `כותרת: ${TITLE_MIN} עד ${TITLE_MAX} תווים`;
  const mins = d.duration_minutes;
  if (!Number.isFinite(mins) || mins < DURATION_MIN || mins > DURATION_MAX) {
    return `משך: ${DURATION_MIN} עד ${DURATION_MAX} דקות`;
  }
  if (d.exercises.some((x) => !x.title.trim())) return 'לכל תרגיל דרושה כותרת';
  return null;
}

const clean = (list: readonly string[]): string[] => [...new Set(list.map((s) => s.trim()).filter(Boolean))];
const orNull = (s: string): string | null => (s.trim() ? s.trim() : null);

/** Only editable columns: version, timestamps and slug are never sent (the DB trigger bumps version). */
export function draftToInput(d: ModuleDraft, id?: string): ModuleInput {
  return {
    ...(id ? { id } : {}),
    title: d.title.trim(), summary: orNull(d.summary), module_type: d.module_type,
    pipeline_stage: orNull(d.pipeline_stage), duration_minutes: Math.round(d.duration_minutes),
    objectives: d.objectives.map((s) => s.trim()).filter(Boolean),
    exercises: d.exercises.map((x) => ({ ...x, title: x.title.trim() })),
    materials: d.materials.filter((x) => x.label.trim()).map((x) => ({ ...x, label: x.label.trim() })),
    facilitator_notes: orNull(d.facilitator_notes), tags: clean(d.tags), requires_app: d.requires_app,
  };
}

export function cloneInput(m: WsModule): ModuleInput {
  const base = draftToInput(draftFromModule(m));
  return {
    ...base, slug: null, parent_module_id: m.id,
    title: `${m.title.slice(0, TITLE_MAX - COPY_SUFFIX.length)}${COPY_SUFFIX}`,
  };
}

// ── immutable list edits ──────────────────────────────────────────────
export const removeAt = <T,>(list: readonly T[], i: number): T[] => list.filter((_, k) => k !== i);

export const replaceAt = <T,>(list: readonly T[], i: number, value: T): T[] =>
  list.map((x, k) => (k === i ? value : x));

export function moveAt<T>(list: readonly T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= list.length || to >= list.length) return [...list];
  const rest = removeAt(list, from);
  return [...rest.slice(0, to), list[from], ...rest.slice(to)];
}
