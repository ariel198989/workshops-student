// The Kahoot door: the facilitator says a 4-digit workshop number out loud, the child types it, and the
// phone signs in as its own device account. The number then goes straight into the join flow
// (ws_find_workshop / ws_join_group accept it as p_code). Pure except for the POST (fetch is injectable).
// The sign-in that follows lives in ./device-login-flow.ts (numberLogin).
import {
  attemptsLeft, DeviceLoginError, deviceLoginErrorMessage, hasCredentials, postDeviceLoginAs, SERVER_UNAVAILABLE,
  type FetchLike,
} from './device-login.ts';
import { isDeviceId } from './device-id.ts';

export const WORKSHOP_NUMBER_LENGTH = 4;
const NUMBER_RE = /^\d{4}$/;
/** Below this many attempts left, the 404 copy says how many remain. */
const WARN_BELOW = 3;

export const isWorkshopNumber = (v: string | null | undefined): v is string => typeof v === 'string' && NUMBER_RE.test(v);

/** Keeps digits only, so "13 57" or "1357 " typed from a whiteboard still counts. */
export const normalizeWorkshopNumber = (raw: string | null | undefined): string => (raw ?? '').replace(/\D/g, '');

export interface NumberLoginWorkshop { id: string; title: string; code: string; short_code: string }
export interface NumberLoginOk { email: string; password: string; workshop: NumberLoginWorkshop }

// ── Hebrew for the number screen ──
export const SEARCHING = 'מחפשים את הסדנה...';
export const NUMBER_NOT_FOUND = 'אין סדנה פתוחה עם המספר הזה. בדקו עם המדריך';
export const NUMBER_BAD_REQUEST = `מספר הסדנה הוא ${WORKSHOP_NUMBER_LENGTH} ספרות`;
export const NUMBER_OFFLINE = 'אין חיבור. נסו שוב';
export const LAST_ATTEMPT = 'זה הניסיון האחרון';

/** status + JSON body of a non-200 answer → one Hebrew sentence. 429 shares the device-login copy (minutes to wait). */
export function numberLoginErrorMessage(status: number, body: unknown): string {
  const b = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
  switch (status) {
    case 404: {
      const remaining = typeof b.remaining === 'number' && b.remaining >= 0 ? Math.floor(b.remaining) : null;
      if (remaining === null || remaining >= WARN_BELOW) return NUMBER_NOT_FOUND;
      return `${NUMBER_NOT_FOUND}. ${remaining === 0 ? LAST_ATTEMPT : attemptsLeft(remaining)}`;
    }
    case 400: return NUMBER_BAD_REQUEST;
    default: return deviceLoginErrorMessage(status, body);
  }
}

/** Whatever the sign-in threw → the line under the keypad. A dropped connection gets its own short copy. */
export function numberLoginFailureMessage(err: unknown): string {
  if (!(err instanceof DeviceLoginError)) return SERVER_UNAVAILABLE;
  return err.kind === 'network' ? NUMBER_OFFLINE : err.message || SERVER_UNAVAILABLE;
}

/** What the number door needs in a 200: credentials and a workshop with id + title (code / short_code are filled in if missing). */
type NumberAnswer = { ok: true; email: string; password: string; workshop: Record<string, unknown> };

function isNumberLoginOk(v: unknown): v is NumberAnswer {
  if (!hasCredentials(v)) return false;
  const w = v.workshop;
  if (!w || typeof w !== 'object') return false;
  const ws = w as Record<string, unknown>;
  return typeof ws.id === 'string' && typeof ws.title === 'string';
}

/** The code the join flow should use: the 4-digit number itself (the RPCs accept it), or whatever the server names. */
export function joinCodeOf(workshop: NumberLoginWorkshop, typed: string): string {
  if (isWorkshopNumber(typed)) return typed;
  return workshop.short_code || workshop.code;
}

/** workshop_number + device_id → credentials. A malformed number or device id never leaves the device. */
export async function requestNumberLogin(number: string, deviceId: string, fetchImpl: FetchLike = fetch): Promise<NumberLoginOk> {
  const clean = normalizeWorkshopNumber(number);
  if (!isWorkshopNumber(clean)) throw new DeviceLoginError(NUMBER_BAD_REQUEST, 'bad_request');
  if (!isDeviceId(deviceId)) throw new DeviceLoginError(SERVER_UNAVAILABLE, 'bad_request');
  const answer = await postDeviceLoginAs({ workshop_number: clean, device_id: deviceId }, numberLoginErrorMessage, isNumberLoginOk, fetchImpl);
  const w = answer.workshop;
  const text = (v: unknown): string => (typeof v === 'string' && v ? v : clean);
  return {
    email: answer.email, password: answer.password,
    workshop: { id: String(w.id), title: String(w.title), code: text(w.code), short_code: text(w.short_code) },
  };
}
