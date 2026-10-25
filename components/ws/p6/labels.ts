// Hebrew labels for curriculum content enums. Short, imperative, no em dashes.
import type { ModuleType, WorkshopFormat } from '@/lib/ws/types';

export const TOOL_HOOKS = [
  'pocket_trainer', 'series_capture', 'phone_tagger', 'cloud_train', 'live_cam', 'map', 'presentation', 'none',
] as const;
export type ToolHook = (typeof TOOL_HOOKS)[number];

export const TOOL_HOOK_LABELS: Record<ToolHook, string> = {
  pocket_trainer: 'מאמן הכיס',
  series_capture: 'צילום סדרות',
  phone_tagger: 'תיוג בטלפון',
  cloud_train: 'אימון בענן',
  live_cam: 'מצלמה חיה',
  map: 'מפה',
  presentation: 'מצגת',
  none: 'ללא כלי',
};

export const PIPELINE_STAGES = [
  'intro', 'grouping', 'problem', 'research', 'collect', 'tag', 'train', 'evaluate', 'present', 'demo',
] as const;
export type PipelineStage = (typeof PIPELINE_STAGES)[number];

export const STAGE_LABELS: Record<PipelineStage, string> = {
  intro: 'היכרות', grouping: 'קבוצות', problem: 'בעיה', research: 'מחקר', collect: 'איסוף',
  tag: 'תיוג', train: 'אימון', evaluate: 'הערכה', present: 'הצגה', demo: 'Demo Day',
};

export const MODULE_TYPE_LABELS: Record<ModuleType, string> = {
  theory: 'תיאוריה', practice: 'תרגול', demo: 'הדגמה', mixed: 'משולב',
};

export const FORMAT_LABELS: Record<WorkshopFormat, string> = {
  sessions: 'סדרת מפגשים', hackathon: 'יום האקתון', custom: 'מותאם',
};

export const EXERCISE_KINDS = ['individual', 'pair', 'group', 'class'] as const;
export type ExerciseKind = (typeof EXERCISE_KINDS)[number];
export const EXERCISE_KIND_LABELS: Record<ExerciseKind, string> = {
  individual: 'אישי', pair: 'בזוגות', group: 'בקבוצות', class: 'כיתתי',
};

export const MATERIAL_KINDS = ['handout', 'supply', 'slides', 'video', 'link'] as const;
export type MaterialKind = (typeof MATERIAL_KINDS)[number];
export const MATERIAL_KIND_LABELS: Record<MaterialKind, string> = {
  handout: 'דף עבודה', supply: 'ציוד', slides: 'מצגת', video: 'סרטון', link: 'קישור',
};

export const AUDIENCES = ['school', 'adult'] as const;
export type Audience = (typeof AUDIENCES)[number];
export const AUDIENCE_LABELS: Record<Audience, string> = { school: 'בית ספר', adult: 'מבוגרים' };

const pick = (map: Record<string, string>, key: string): string =>
  Object.hasOwn(map, key) ? map[key] : key;

export const toolHookLabel = (key: string): string => pick(TOOL_HOOK_LABELS, key);
export const stageLabel = (key: string | null): string => (key ? pick(STAGE_LABELS, key) : '');
export const typeLabel = (key: string): string => pick(MODULE_TYPE_LABELS, key);
export const kindLabel = (key: string): string => pick(EXERCISE_KIND_LABELS, key);
export const materialKindLabel = (key: string): string => pick(MATERIAL_KIND_LABELS, key);

/** Pill tone per module type, reusing the shared Pill palette. */
export const TYPE_TONES = { theory: 'blue', practice: 'teal', demo: 'amber', mixed: 'navy' } as const;
export const typeTone = (key: string): 'blue' | 'teal' | 'amber' | 'navy' | 'gray' =>
  Object.hasOwn(TYPE_TONES, key) ? TYPE_TONES[key as keyof typeof TYPE_TONES] : 'gray';
