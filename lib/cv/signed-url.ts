'use client';
// Links to photos in the private ws-media bucket. There is no public URL: the server signs a
// link that lives about an hour. Links are cached per path and signed again once they near expiry.
import { MEDIA_BUCKET } from '../config';
import { sb } from '../db';
import { EMPTY_SIGNED, freshUrl, pathsToSign, SIGNED_TTL_S, withoutPath, withSigned, type SignedCache } from './signed-cache';

export const PHOTO_ERROR = 'התמונה לא נטענה. בדקו את החיבור ונסו שוב';

let cache: SignedCache = EMPTY_SIGNED;

/** The cached link, if one is still alive. No network. */
export const peekSignedUrl = (path: string): string | null => freshUrl(cache, path, Date.now());

/** Drop a link that failed to load, so the next request signs a new one. */
export function forgetSignedUrl(path: string): void {
  cache = withoutPath(cache, path);
}

/**
 * Links for many photos in ONE request (lists, thumbnails, a queue). Only paths without a live link
 * are signed. A path the server refused (deleted file, another group's) is simply absent from the result.
 */
export async function signedUrls(paths: readonly string[]): Promise<ReadonlyMap<string, string>> {
  const missing = pathsToSign(cache, paths, Date.now());
  if (missing.length > 0) {
    const { data, error } = await sb.storage.from(MEDIA_BUCKET).createSignedUrls(missing, SIGNED_TTL_S);
    if (error) throw new Error(error.message);
    cache = withSigned(cache, data ?? [], Date.now());
  }
  const now = Date.now();
  return new Map(paths.flatMap((p): [string, string][] => {
    const url = freshUrl(cache, p, now);
    return url ? [[p, url]] : [];
  }));
}

/** The link for one photo; throws our Hebrew message when the server would not sign it. */
export async function signedUrl(path: string): Promise<string> {
  const url = (await signedUrls([path])).get(path);
  if (!url) throw new Error(PHOTO_ERROR);
  return url;
}
