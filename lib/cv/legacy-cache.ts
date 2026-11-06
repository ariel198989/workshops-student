// Cache Storage buckets left on devices by builds from before the workshops were split from
// Smart City. Deleted once on app start. No imports on purpose: unit tested under plain Node.

/** 'sc-models-v1' held Smart City model ZIPs; the workshops cache is MODEL_CACHE ('ws-models-v1'). */
export const LEGACY_CACHES: readonly string[] = ['sc-models-v1'];

/** The slice of the browser's CacheStorage this needs. */
export interface CacheStorageLike {
  has: (name: string) => Promise<boolean>;
  delete: (name: string) => Promise<boolean>;
}

/** window.caches, or null where there is none (old webviews, insecure origins) or touching it throws. */
export function browserCaches(): CacheStorageLike | null {
  try {
    const c = (globalThis as { caches?: CacheStorageLike }).caches;
    return c && typeof c.has === 'function' && typeof c.delete === 'function' ? c : null;
  } catch {
    return null;
  }
}

/** Deletes each legacy bucket that is present; resolves with the names deleted. Never throws. */
export async function purgeLegacyCaches(storage: CacheStorageLike | null, names: readonly string[] = LEGACY_CACHES): Promise<string[]> {
  if (!storage) return [];
  const deleted: string[] = [];
  for (const name of names) {
    try {
      if ((await storage.has(name)) && (await storage.delete(name))) deleted.push(name);
    } catch { /* a cache we cannot touch is not worth an error on start */ }
  }
  return deleted;
}
