import type { JsonObject } from '../../../lib/ws/types';

// Readers for the frozen jsonb written by ws_lock_deliverable. Anything with the wrong type is dropped.

export interface ModelSnapshotView {
  name: string; accuracyPct: number | null; imageCount: number | null; honestVal: boolean | null;
  approved: boolean | null; classes: string[]; createdAt: string | null;
}
export interface DatasetSnapshotView {
  photos: number; tagged: number; contributors: number; capturedAt: string | null;
  coverage: { name: string; tagged: number }[];
}

const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const str = (v: unknown): string | null => (typeof v === 'string' ? v : null);
const bool = (v: unknown): boolean | null => (typeof v === 'boolean' ? v : null);

export function readModelSnapshot(raw: JsonObject | null): ModelSnapshotView | null {
  if (!raw) return null;
  const accuracy = num(raw.accuracy);
  return {
    name: str(raw.name) ?? '',
    accuracyPct: accuracy === null ? null : Math.round(accuracy * 100),
    imageCount: num(raw.image_count),
    honestVal: bool(raw.honest_val),
    approved: bool(raw.approved),
    classes: Array.isArray(raw.classes) ? raw.classes.filter((c): c is string => typeof c === 'string') : [],
    createdAt: str(raw.created_at),
  };
}

export function readDatasetSnapshot(raw: JsonObject | null): DatasetSnapshotView | null {
  if (!raw) return null;
  const coverage = Array.isArray(raw.coverage) ? raw.coverage : [];
  return {
    photos: num(raw.photos) ?? 0,
    tagged: num(raw.tagged) ?? 0,
    contributors: num(raw.contributors) ?? 0,
    capturedAt: str(raw.captured_at),
    coverage: coverage.flatMap((c) => {
      if (!c || typeof c !== 'object') return [];
      const { name, tagged } = c as Record<string, unknown>;
      return typeof name === 'string' ? [{ name, tagged: num(tagged) ?? 0 }] : [];
    }),
  };
}

/** sc_models.accuracy is a 0..1 mAP50. */
export const formatAccuracy = (accuracy: number | null): string =>
  accuracy === null || accuracy === undefined ? '-' : `${Math.round(accuracy * 100)}%`;
