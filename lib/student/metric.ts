// How a model's quality is told to students, by the workshop's metric mode. Pure: no React, no Supabase.
// Younger bands never see a percent sign; the full numbers appear only in map_pr (L4).
import { accuracyPercent, isWeak, parseClassStats, type ClassStat } from '../cv/readiness.ts';
import type { MetricMode } from './caps.ts';

export type BarColor = 'green' | 'yellow' | 'red';

export interface MetricBar { fill: number; color: BarColor }

/** One row per object the model learned. `text` is already in the band's language ('כן', 'ציון 7', '83%'). */
export interface MetricClassLine {
  name: string;
  text: string;
  /** 0..1 for the small bar; null when this mode shows no bar (yes_no) or the value is unknown */
  fill: number | null;
  weak: boolean;
  /** 'צדק ומצא 12 · פספס 3 · התריע סתם 2' when the trainer wrote counts; omitted otherwise */
  detail?: string;
}

export interface MetricTable { columns: string[]; rows: { name: string; cells: string[] }[] }

export interface MetricViewModel {
  headline: string;
  bar?: MetricBar;
  lines: string[];
  classes: MetricClassLine[];
  table?: MetricTable;
  /** the footnote under the per-object list, in the band's language */
  weakNote: string;
}

/** The slice of a model the metric needs; TeamModel and StudentProgress.model both satisfy it. */
export interface MetricModel {
  accuracy: number | null;
  class_stats: unknown;
}

export const OUT_OF_TEN = 'מתוך 10';
const NOT_MEASURED = 'עוד לא נמדד';
const YES = 'כן';
const NO = 'לא';
/** an object counts as recognised when its AP50 is at least this */
const YES_FROM = 0.5;

const PRECISION_WORDS = 'מתוך מה שסימן, כמה היה נכון';
const RECALL_WORDS = 'מתוך מה שהיה, כמה מצא';

const WEAK_NOTE_WORDS = 'אובייקט מסומן כחלש כשהמודל עדיין לא מזהה אותו טוב, או כשהיו לו מעט תמונות באימון.';
const WEAK_NOTE_NUMBERS = 'אובייקט מסומן כחלש כשהציון שלו מתחת ל-50% או כשהיו לו פחות מ-20 תיבות באימון.';

/** 0..1 (tolerating values already in percent) → 0..1, or null. */
function unit(value: number | null | undefined): number | null {
  const pct = accuracyPercent(value);
  return pct === null ? null : Math.min(1, Math.max(0, pct / 100));
}

/** 'X מתוך 10' from a 0..1 value. */
export function tenths(value: number | null | undefined): number | null {
  const u = unit(value);
  return u === null ? null : Math.round(u * 10);
}

export const outOfTen = (n: number): string => `${n} ${OUT_OF_TEN}`;

/** A 1..10 score: a model that exists never scores 0. */
export function scoreOf(value: number | null | undefined): number | null {
  const t = tenths(value);
  return t === null ? null : Math.max(1, t);
}

export function barColor(tenth: number): BarColor {
  if (tenth >= 8) return 'green';
  if (tenth >= 5) return 'yellow';
  return 'red';
}

const bar = (tenth: number): MetricBar => ({ fill: tenth / 10, color: barColor(tenth) });

const pct = (value: number | null | undefined): string => {
  const p = accuracyPercent(value);
  return p === null ? NOT_MEASURED : `${p}%`;
};

function counts(stat: ClassStat): string | undefined {
  if (stat.tp === undefined && stat.fp === undefined && stat.fn === undefined) return undefined;
  const parts = [
    stat.tp !== undefined ? `צדק ומצא ${stat.tp}` : null,
    stat.fn !== undefined ? `פספס ${stat.fn}` : null,
    stat.fp !== undefined ? `התריע סתם ${stat.fp}` : null,
  ].filter((p): p is string => p !== null);
  return parts.join(' · ');
}

function average(values: (number | undefined)[]): number | null {
  const known = values.filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
  return known.length ? known.reduce((a, b) => a + b, 0) / known.length : null;
}

/** Model-level precision / recall, averaged over the classes that report them. */
function precisionRecall(stats: ClassStat[]): { precision: number | null; recall: number | null } {
  return {
    precision: average(stats.map((s) => s.precision)),
    recall: average(stats.map((s) => s.recall)),
  };
}

const classLine = (stat: ClassStat, text: string, fill: number | null, detail?: string): MetricClassLine => ({
  name: stat.name, text, fill, weak: isWeak(stat), ...(detail ? { detail } : {}),
});

function yesNo(model: MetricModel, stats: ClassStat[]): MetricViewModel {
  const overall = unit(model.accuracy);
  const headline = overall === null ? `המודל מזהה? ${NOT_MEASURED}` : `המודל מזהה? ${overall >= YES_FROM ? YES : NO}`;
  return {
    headline,
    lines: [],
    classes: stats.map((s) => {
      const u = unit(s.ap50);
      return classLine(s, u === null ? NOT_MEASURED : u >= YES_FROM ? YES : NO, null);
    }),
    weakNote: WEAK_NOTE_WORDS,
  };
}

function xOfTen(model: MetricModel, stats: ClassStat[]): MetricViewModel {
  const t = tenths(model.accuracy);
  return {
    headline: t === null ? NOT_MEASURED : outOfTen(t),
    ...(t === null ? {} : { bar: bar(t) }),
    lines: t === null ? [] : ['כמה פעמים מתוך 10 המודל מוצא את האובייקט נכון'],
    classes: stats.map((s) => {
      const st = tenths(s.ap50);
      return classLine(s, st === null ? NOT_MEASURED : outOfTen(st), st === null ? null : st / 10);
    }),
    weakNote: WEAK_NOTE_WORDS,
  };
}

function scoreOneToTen(model: MetricModel, stats: ClassStat[], headlinePrefix: string): MetricViewModel {
  const score = scoreOf(model.accuracy);
  return {
    headline: score === null ? NOT_MEASURED : `${headlinePrefix} ${score}`,
    ...(score === null ? {} : { bar: bar(score) }),
    lines: [],
    classes: stats.map((s) => {
      const sc = scoreOf(s.ap50);
      return classLine(s, sc === null ? NOT_MEASURED : `ציון ${sc}`, sc === null ? null : sc / 10, counts(s));
    }),
    weakNote: WEAK_NOTE_WORDS,
  };
}

function modelScore(model: MetricModel, stats: ClassStat[]): MetricViewModel {
  const base = scoreOneToTen(model, stats, 'ציון המודל');
  const { precision, recall } = precisionRecall(stats);
  const p = tenths(precision);
  const r = tenths(recall);
  return {
    ...base,
    lines: [
      ...(p === null ? [] : [`${PRECISION_WORDS}: ${outOfTen(p)}`]),
      ...(r === null ? [] : [`${RECALL_WORDS}: ${outOfTen(r)}`]),
    ],
  };
}

function mapPr(model: MetricModel, stats: ClassStat[]): MetricViewModel {
  const mapPct = accuracyPercent(model.accuracy);
  const { precision, recall } = precisionRecall(stats);
  const hasPr = stats.some((s) => s.precision !== undefined || s.recall !== undefined);
  return {
    headline: mapPct === null ? `mAP50 ${NOT_MEASURED}` : `mAP50 ${mapPct}%`,
    ...(mapPct === null ? {} : { bar: bar(Math.round(mapPct / 10)) }),
    lines: [
      ...(precision === null ? [] : [`precision ${pct(precision)} (${PRECISION_WORDS})`]),
      ...(recall === null ? [] : [`recall ${pct(recall)} (${RECALL_WORDS})`]),
    ],
    classes: stats.map((s) => classLine(s, pct(s.ap50), unit(s.ap50), counts(s))),
    ...(hasPr ? {
      table: {
        columns: ['אובייקט', 'AP50', 'precision', 'recall', 'תיבות'],
        rows: stats.map((s) => ({
          name: s.name,
          cells: [pct(s.ap50), s.precision === undefined ? '—' : pct(s.precision),
            s.recall === undefined ? '—' : pct(s.recall), s.boxes == null ? '—' : String(s.boxes)],
        })),
      },
    } : {}),
    weakNote: WEAK_NOTE_NUMBERS,
  };
}

/** The model's quality in the band's language. Unknown class_stats shapes degrade to an empty class list. */
export function formatMetric(mode: MetricMode, model: MetricModel): MetricViewModel {
  const stats = parseClassStats(model.class_stats);
  switch (mode) {
    case 'yes_no': return yesNo(model, stats);
    case 'x_of_10': return xOfTen(model, stats);
    case 'score_1_10': return scoreOneToTen(model, stats, 'ציון');
    case 'model_score': return modelScore(model, stats);
    case 'map_pr': return mapPr(model, stats);
  }
}

/** Modes that show the model's numbers (and so the honest-validation note belongs next to them). */
export const showsNumbers = (mode: MetricMode): boolean => mode !== 'yes_no';
