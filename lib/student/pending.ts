// Small things the signed-out screens hand to the signed-in ones through sessionStorage:
// a workshop code scanned from the facilitator's QR (/join?code=...) that must survive sign-up,
// and a hint to open the code + PIN entry straight away. Pure over a Storage-like object, so Node can test it.
import { isCodeComplete, normalizeCode } from './code.ts';

export const PENDING_CODE_KEY = 'ws.pendingCode';
export const ENTRY_HINT_KEY = 'ws.entry';

export type EntryHint = 'pin';

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** window.sessionStorage, or null when there is no window or the browser blocks it (private mode). */
export function sessionStorageOrNull(): StorageLike | null {
  try {
    return typeof window === 'undefined' ? null : window.sessionStorage;
  } catch {
    return null;
  }
}

/** The ?code= of a scanned join QR, normalised; null when missing or too short to be a code. */
export function codeFromSearch(search: URLSearchParams | string | null | undefined): string | null {
  if (search === null || search === undefined) return null;
  const params = typeof search === 'string' ? new URLSearchParams(search) : search;
  const clean = normalizeCode(params.get('code'));
  return isCodeComplete(clean) ? clean : null;
}

const read = (storage: StorageLike | null, key: string): string | null => {
  try {
    return storage?.getItem(key) ?? null;
  } catch {
    return null;
  }
};

const write = (storage: StorageLike | null, key: string, value: string | null): void => {
  try {
    if (value === null) storage?.removeItem(key);
    else storage?.setItem(key, value);
  } catch {
    // storage full or blocked: the student types the code instead
  }
};

/** Stores a complete code and returns it; anything else is ignored and returns null. */
export function storePendingCode(storage: StorageLike | null, raw: string | null | undefined): string | null {
  const clean = normalizeCode(raw);
  if (!isCodeComplete(clean)) return null;
  write(storage, PENDING_CODE_KEY, clean);
  return clean;
}

/** The stored code, still stored. */
export function peekPendingCode(storage: StorageLike | null): string | null {
  const clean = normalizeCode(read(storage, PENDING_CODE_KEY));
  return isCodeComplete(clean) ? clean : null;
}

/** The stored code, removed so it is consumed once. */
export function takePendingCode(storage: StorageLike | null): string | null {
  const code = peekPendingCode(storage);
  if (read(storage, PENDING_CODE_KEY) !== null) write(storage, PENDING_CODE_KEY, null);
  return code;
}

export function storeEntryHint(storage: StorageLike | null, hint: EntryHint): void {
  write(storage, ENTRY_HINT_KEY, hint);
}

/** The hint, removed so it is consumed once. Unknown values are dropped. */
export function takeEntryHint(storage: StorageLike | null): EntryHint | null {
  const value = read(storage, ENTRY_HINT_KEY);
  if (value !== null) write(storage, ENTRY_HINT_KEY, null);
  return value === 'pin' ? 'pin' : null;
}
