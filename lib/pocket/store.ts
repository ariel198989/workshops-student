// Saved trainer per workshop in localStorage: class names + the kNN dataset as
// plain arrays. No tfjs here; engine.ts turns tensors into arrays and back.
// Nothing ever leaves the device.

export const STORE_PREFIX = 'ws_pocket_v1:';
export const FREE_WORKSHOP = 'free';
/** 4 decimals keep three classes x 60 embeddings of 1280 floats under ~2MB of JSON. */
const DECIMALS = 4;

export interface SavedClass { data: number[]; shape: [number, number] }

export interface SavedTrainer {
  classes: string[];
  dataset: Record<string, SavedClass>;
  savedAt: number;
}

export interface StorageLike {
  getItem: (k: string) => string | null;
  setItem: (k: string, v: string) => void;
  removeItem: (k: string) => void;
}

export const storageKey = (workshopId: string | null): string => `${STORE_PREFIX}${workshopId ?? FREE_WORKSHOP}`;

export function roundVector(values: ArrayLike<number>): number[] {
  const f = 10 ** DECIMALS;
  return Array.from(values, (v) => Math.round(v * f) / f);
}

function isSavedClass(v: unknown): v is SavedClass {
  if (!v || typeof v !== 'object') return false;
  const c = v as Partial<SavedClass>;
  return Array.isArray(c.data) && Array.isArray(c.shape) && c.shape.length === 2
    && c.data.length === c.shape[0] * c.shape[1];
}

/** Rejects anything that is not exactly the shape we wrote; a corrupt entry is just "nothing saved". */
export function decodeTrainer(json: string | null): SavedTrainer | null {
  if (!json) return null;
  try {
    const v = JSON.parse(json) as Partial<SavedTrainer> | null;
    if (!v || !Array.isArray(v.classes) || !v.dataset || typeof v.dataset !== 'object') return null;
    const classes = v.classes.filter((c): c is string => typeof c === 'string');
    const dataset: Record<string, SavedClass> = {};
    for (const [label, cls] of Object.entries(v.dataset)) {
      if (classes.includes(label) && isSavedClass(cls)) dataset[label] = cls;
    }
    return { classes, dataset, savedAt: typeof v.savedAt === 'number' ? v.savedAt : 0 };
  } catch {
    return null;
  }
}

export const encodeTrainer = (t: SavedTrainer): string => JSON.stringify(t);

function browserStorage(): StorageLike | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

export function loadTrainer(workshopId: string | null, storage: StorageLike | null = browserStorage()): SavedTrainer | null {
  try {
    return decodeTrainer(storage?.getItem(storageKey(workshopId)) ?? null);
  } catch {
    return null;
  }
}

/** False when storage is full or blocked; the model still lives in memory this session. */
export function saveTrainer(workshopId: string | null, t: SavedTrainer, storage: StorageLike | null = browserStorage()): boolean {
  try {
    storage?.setItem(storageKey(workshopId), encodeTrainer(t));
    return !!storage;
  } catch {
    return false;
  }
}

export function clearTrainer(workshopId: string | null, storage: StorageLike | null = browserStorage()): void {
  try {
    storage?.removeItem(storageKey(workshopId));
  } catch {
    /* private mode */
  }
}

export const exampleCount = (t: SavedTrainer): number =>
  Object.values(t.dataset).reduce((n, c) => n + c.shape[0], 0);
