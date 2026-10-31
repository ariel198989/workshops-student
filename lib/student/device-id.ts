// One random id per phone or tablet, minted once and kept in localStorage. The ws-device-login edge
// function keys the device account (dev-...@devices.corewise.local) on it, so the same device keeps
// its identity across sessions. Pure over a Storage-like object and an injectable random source.
import type { StorageLike } from './pending.ts';

export const DEVICE_ID_KEY = 'ws.deviceId';
export const DEVICE_ID_LENGTH = 32;
const DEVICE_ID_RE = /^[A-Za-z0-9_-]{16,64}$/;
/** 64 symbols, so one random byte masked to 6 bits picks one without bias. */
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-';

export type RandomBytes = (length: number) => Uint8Array;

/** What the edge function accepts: 16 to 64 of [A-Za-z0-9_-]. */
export const isDeviceId = (v: string | null | undefined): v is string => typeof v === 'string' && DEVICE_ID_RE.test(v);

/** crypto.getRandomValues; throws when the runtime has no WebCrypto (then the caller has no way to mint an id). */
export const cryptoRandom: RandomBytes = (length) => crypto.getRandomValues(new Uint8Array(length));

/** A fresh 32-char id. */
export function newDeviceId(random: RandomBytes = cryptoRandom): string {
  const bytes = random(DEVICE_ID_LENGTH);
  return Array.from(bytes.slice(0, DEVICE_ID_LENGTH), (b) => ALPHABET[b & 63]).join('');
}

/** window.localStorage, or null when there is no window or the browser blocks it (private mode). */
export function localStorageOrNull(): StorageLike | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

/**
 * The stored id when it is still well-formed; otherwise a new one, stored for next time.
 * With no usable storage the id is minted anyway (the sign-in still works, the identity just does not persist).
 */
export function getOrCreateDeviceId(storage: StorageLike | null, random: RandomBytes = cryptoRandom): string {
  let stored: string | null = null;
  try {
    stored = storage?.getItem(DEVICE_ID_KEY) ?? null;
  } catch {
    stored = null;
  }
  if (isDeviceId(stored)) return stored;
  const fresh = newDeviceId(random);
  try {
    storage?.setItem(DEVICE_ID_KEY, fresh);
  } catch {
    // storage full or blocked: this sign-in uses the fresh id, the next one mints another
  }
  return fresh;
}
