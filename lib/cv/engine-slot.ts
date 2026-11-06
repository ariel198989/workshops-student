// One live inference engine at a time, keyed by the model's zip_path. Switching between my model and the
// group's model can overlap two loads: only the newest request may become live; an older one that lands
// later is disposed and rejected as stale. Pure (no imports): unit tested under Node with fake loads.

export class StaleLoadError extends Error {
  constructor(path: string) {
    super(`engine load for ${path} was superseded`);
    this.name = 'StaleLoadError';
  }
}

export const isStaleLoad = (e: unknown): boolean => e instanceof Error && e.name === 'StaleLoadError';

export interface EngineSlot<E> {
  /** The engine for this path: the live one, the load already in flight, or a new load. */
  get: (path: string) => Promise<E>;
  /** Dispose the live engine and make any load in flight stale. */
  drop: () => void;
  livePath: () => string | null;
}

export function createEngineSlot<E>(load: (path: string) => Promise<E>, dispose: (engine: E) => void): EngineSlot<E> {
  let live: { path: string; engine: E } | null = null;
  let inflight: { path: string; promise: Promise<E>; token: object } | null = null;

  function get(path: string): Promise<E> {
    if (live?.path === path) return Promise.resolve(live.engine);
    if (inflight?.path === path) return inflight.promise;
    const token = {};
    const promise = (async () => {
      const engine = await load(path);
      if (inflight?.token !== token) { // a newer request (or drop) came in meanwhile
        dispose(engine);
        throw new StaleLoadError(path);
      }
      if (live) dispose(live.engine);
      live = { path, engine };
      return engine;
    })().finally(() => {
      if (inflight?.token === token) inflight = null; // never clear a newer load's slot
    });
    inflight = { path, promise, token };
    return promise;
  }

  return {
    get,
    drop: () => {
      if (live) dispose(live.engine);
      live = null;
      inflight = null;
    },
    livePath: () => live?.path ?? null,
  };
}
