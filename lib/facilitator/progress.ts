// Per-workshop ticks for המפגש: which agenda items and modules the facilitator
// marked done. localStorage only; a blocked or full storage just means nothing
// is remembered.
import type { StorageLike } from '@/lib/pocket/store';

export const PROGRESS_PREFIX = 'ws_guide_v1:';

export interface GuideProgress {
  agenda: string[];
  modules: string[];
}

export const emptyProgress = (): GuideProgress => ({ agenda: [], modules: [] });
export const progressKey = (workshopId: string): string => `${PROGRESS_PREFIX}${workshopId}`;
export const agendaId = (moduleId: string, index: number): string => `${moduleId}:${index}`;

function browserStorage(): StorageLike | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

export function decodeProgress(json: string | null): GuideProgress {
  if (!json) return emptyProgress();
  try {
    const v = JSON.parse(json) as Partial<GuideProgress> | null;
    if (!v || typeof v !== 'object') return emptyProgress();
    const strs = (x: unknown): string[] => (Array.isArray(x) ? x.filter((s): s is string => typeof s === 'string') : []);
    return { agenda: strs(v.agenda), modules: strs(v.modules) };
  } catch {
    return emptyProgress();
  }
}

export function loadProgress(workshopId: string, storage: StorageLike | null = browserStorage()): GuideProgress {
  try {
    return decodeProgress(storage?.getItem(progressKey(workshopId)) ?? null);
  } catch {
    return emptyProgress();
  }
}

export function saveProgress(workshopId: string, p: GuideProgress, storage: StorageLike | null = browserStorage()): boolean {
  try {
    storage?.setItem(progressKey(workshopId), JSON.stringify(p));
    return !!storage;
  } catch {
    return false;
  }
}

export function clearProgress(workshopId: string, storage: StorageLike | null = browserStorage()): void {
  try {
    storage?.removeItem(progressKey(workshopId));
  } catch {
    /* private mode */
  }
}

const toggleIn = (list: readonly string[], id: string, on?: boolean): string[] => {
  const has = list.includes(id);
  const want = on ?? !has;
  if (want === has) return [...list];
  return want ? [...list, id] : list.filter((x) => x !== id);
};

export const toggleAgenda = (p: GuideProgress, id: string, on?: boolean): GuideProgress =>
  ({ ...p, agenda: toggleIn(p.agenda, id, on) });

export const toggleModule = (p: GuideProgress, id: string, on?: boolean): GuideProgress =>
  ({ ...p, modules: toggleIn(p.modules, id, on) });

export const isAgendaDone = (p: GuideProgress, id: string): boolean => p.agenda.includes(id);
export const isModuleDone = (p: GuideProgress, id: string): boolean => p.modules.includes(id);

/** Drops every tick that belongs to one module (״אפס״ on a card). */
export const resetModule = (p: GuideProgress, moduleId: string): GuideProgress => ({
  agenda: p.agenda.filter((id) => !id.startsWith(`${moduleId}:`)),
  modules: p.modules.filter((id) => id !== moduleId),
});

/** The first unchecked agenda item across the given ordered list; null when all are done. */
export function nextUndone<T extends { id: string }>(items: readonly T[], p: GuideProgress): T | null {
  return items.find((it) => !p.agenda.includes(it.id)) ?? null;
}
