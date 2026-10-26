// The 'קול' toggle, remembered per device. Off by default: autoplay rules and
// quiet classrooms both want the facilitator to opt in.

export const VOICE_KEY = 'ws_robot_voice_v1';

export interface StorageLike {
  getItem: (k: string) => string | null;
  setItem: (k: string, v: string) => void;
}

function browserStorage(): StorageLike | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

export function loadVoicePref(storage: StorageLike | null = browserStorage()): boolean {
  try {
    return storage?.getItem(VOICE_KEY) === '1';
  } catch {
    return false;
  }
}

export function saveVoicePref(on: boolean, storage: StorageLike | null = browserStorage()): void {
  try {
    storage?.setItem(VOICE_KEY, on ? '1' : '0');
  } catch {
    /* private mode: the toggle still works for this page */
  }
}
