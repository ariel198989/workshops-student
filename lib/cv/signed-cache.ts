// Pure cache rules for signed links into the private ws-media bucket: a link lives about an hour,
// is reused until shortly before that, and is then signed again. No imports: unit tested under plain Node.

export const SIGNED_TTL_S = 3600;
/** A link is replaced this long before the server would refuse it, so an <img> never starts on a dying link. */
export const RENEW_BEFORE_MS = 5 * 60000;

interface SignedEntry { url: string; freshUntil: number }
export type SignedCache = ReadonlyMap<string, SignedEntry>;

/** One item of storage createSignedUrls(): a refused path comes back with an error and no link. */
export interface SignedItem { path: string | null; signedUrl: string | null; error?: string | null }

export const EMPTY_SIGNED: SignedCache = new Map();

export function freshUrl(cache: SignedCache, path: string, now: number): string | null {
  const entry = cache.get(path);
  return entry && entry.freshUntil > now ? entry.url : null;
}

/** The unique paths that still need a link. */
export function pathsToSign(cache: SignedCache, paths: readonly string[], now: number): string[] {
  return [...new Set(paths)].filter((p) => !freshUrl(cache, p, now));
}

/** A new cache with the freshly signed links added and the expired ones dropped. */
export function withSigned(cache: SignedCache, items: readonly SignedItem[], now: number, ttlS = SIGNED_TTL_S): SignedCache {
  const freshUntil = now + ttlS * 1000 - RENEW_BEFORE_MS;
  const kept = [...cache].filter(([, entry]) => entry.freshUntil > now);
  const added = items.flatMap((i): [string, SignedEntry][] => (
    i.path && i.signedUrl && !i.error ? [[i.path, { url: i.signedUrl, freshUntil }]] : []
  ));
  return new Map([...kept, ...added]);
}

export function withoutPath(cache: SignedCache, path: string): SignedCache {
  return new Map([...cache].filter(([p]) => p !== path));
}
