// Tablet sign-in without email: workshop code + group number + 4-digit PIN, exchanged at the
// ws-device-login edge function for the group device account's credentials. Pure except for the
// POST itself (fetch is injectable), so Node can test the mapping and the keypad reducer.
// The sign-in that follows (supabase auth + context refresh) lives in ./device-login-flow.ts.
import { SB_KEY, SB_URL } from '../config.ts';
import { isCodeComplete, normalizeCode } from './code.ts';

export const PIN_LENGTH = 4;
export const GROUP_MIN = 1;
export const GROUP_MAX = 12;
export const DEVICE_LOGIN_URL = `${SB_URL}/functions/v1/ws-device-login`;

/** Group numbers offered on the grid (the code lookup needs a session, so the grid is fixed). */
export const GROUP_NUMBERS: readonly number[] = Array.from({ length: GROUP_MAX - GROUP_MIN + 1 }, (_, i) => GROUP_MIN + i);

export interface DeviceLoginInput { code: string; group: number; pin: string }

export interface DeviceLoginOk {
  email: string;
  password: string;
  workshop: { id: string; title: string };
  group: { id: string; number: number; label: string };
}

/** Why the sign-in failed, so a screen can decide between retry, manual entry and a plain message. */
export type DeviceLoginFailure = 'network' | 'bad_request' | 'not_found' | 'bad_pin' | 'locked' | 'server';

/** Error whose message is already safe, Hebrew copy for the group. */
export class DeviceLoginError extends Error {
  readonly kind: DeviceLoginFailure;
  constructor(message: string, kind: DeviceLoginFailure = 'server') {
    super(message);
    this.kind = kind;
  }
}

export function deviceLoginFailureKind(status: number): DeviceLoginFailure {
  switch (status) {
    case 400: return 'bad_request';
    case 404: return 'not_found';
    case 401: return 'bad_pin';
    case 429: return 'locked';
    default: return 'server';
  }
}

// ── Hebrew for every answer of the edge function ──
export const SERVER_UNAVAILABLE = 'השרת לא זמין כרגע. נסו שוב בעוד רגע';
export const OFFLINE = 'אין חיבור לאינטרנט. בדקו את הרשת ונסו שוב';
const GENERIC = SERVER_UNAVAILABLE;
const BAD_REQUEST = 'משהו בפרטים לא תקין. בדקו את הקוד, את מספר הקבוצה ואת הקוד הסודי';
const NOT_FOUND = 'לא מצאנו סדנה פתוחה עם הקוד והקבוצה האלה';
const BAD_PIN = 'הקוד הסודי לא נכון';
const DEFAULT_LOCK_MINUTES = 15;

const attemptsLeft = (n: number): string => (n === 1 ? 'נשאר ניסיון אחד' : `נשארו ${n} ניסיונות`);

/** status + the JSON body of a non-200 answer → one Hebrew sentence. Unknown shapes get the generic line. */
export function deviceLoginErrorMessage(status: number, body: unknown): string {
  const b = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
  switch (status) {
    case 400: return BAD_REQUEST;
    case 404: return NOT_FOUND;
    case 401: {
      const remaining = typeof b.remaining === 'number' && b.remaining >= 0 ? Math.floor(b.remaining) : null;
      return remaining === null ? BAD_PIN : `${BAD_PIN}. ${attemptsLeft(remaining)}`;
    }
    case 429: {
      const minutes = typeof b.retry_minutes === 'number' && b.retry_minutes > 0 ? Math.ceil(b.retry_minutes) : DEFAULT_LOCK_MINUTES;
      return `יותר מדי ניסיונות. חכו ${minutes} דקות`;
    }
    default: return GENERIC;
  }
}

export const isValidPin = (pin: string): boolean => new RegExp(`^\\d{${PIN_LENGTH}}$`).test(pin);
export const isValidGroup = (n: number): boolean => Number.isInteger(n) && n >= GROUP_MIN && n <= GROUP_MAX;

/** Null when the three fields can be sent as they are; otherwise the Hebrew reason. */
export function validateDeviceLogin(input: DeviceLoginInput): string | null {
  if (!isCodeComplete(normalizeCode(input.code))) return 'כתבו את קוד הסדנה שקיבלתם מהמדריך';
  if (!isValidGroup(input.group)) return `בחרו מספר קבוצה בין ${GROUP_MIN} ל-${GROUP_MAX}`;
  if (!isValidPin(input.pin)) return `הקוד הסודי הוא ${PIN_LENGTH} ספרות`;
  return null;
}

export type FetchLike = (url: string, init: RequestInit) => Promise<{ status: number; ok: boolean; json: () => Promise<unknown> }>;

/** Either body the edge function accepts: the tablet's three fields, or the group's QR token. */
export type DeviceLoginBody = { code: string; group: number; pin: string } | { join_token: string };

/** Turns a non-200 status and its JSON body into the Hebrew the screen shows. */
export type ErrorMessageOf = (status: number, body: unknown) => string;

function isOkBody(v: unknown): v is DeviceLoginOk & { ok: true } {
  if (!v || typeof v !== 'object') return false;
  const b = v as Record<string, unknown>;
  return b.ok === true && typeof b.email === 'string' && typeof b.password === 'string'
    && !!b.workshop && typeof b.workshop === 'object' && !!b.group && typeof b.group === 'object';
}

/** POSTs one accepted body to the edge function. Throws DeviceLoginError with Hebrew text; never logs the password. */
export async function postDeviceLogin(
  body: DeviceLoginBody, messageOf: ErrorMessageOf = deviceLoginErrorMessage, fetchImpl: FetchLike = fetch,
): Promise<DeviceLoginOk> {
  let res: Awaited<ReturnType<FetchLike>>;
  try {
    res = await fetchImpl(DEVICE_LOGIN_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json', apikey: SB_KEY, authorization: `Bearer ${SB_KEY}` },
      body: JSON.stringify(body),
    });
  } catch {
    throw new DeviceLoginError(OFFLINE, 'network');
  }
  const answer = await res.json().catch(() => null);
  if (!res.ok) throw new DeviceLoginError(messageOf(res.status, answer), deviceLoginFailureKind(res.status));
  if (!isOkBody(answer)) throw new DeviceLoginError(GENERIC, 'server');
  return { email: answer.email, password: answer.password, workshop: answer.workshop, group: answer.group };
}

/** Code + group + PIN → credentials. Validates first, then POSTs. */
export async function requestDeviceLogin(input: DeviceLoginInput, fetchImpl: FetchLike = fetch): Promise<DeviceLoginOk> {
  const invalid = validateDeviceLogin(input);
  if (invalid) throw new DeviceLoginError(invalid, 'bad_request');
  return postDeviceLogin({ code: normalizeCode(input.code), group: input.group, pin: input.pin }, deviceLoginErrorMessage, fetchImpl);
}

// ── PIN keypad ──
export interface PinState { digits: string }
export type PinAction = { type: 'digit'; value: string } | { type: 'back' } | { type: 'clear' };

export const EMPTY_PIN: PinState = { digits: '' };

/** Appends one digit up to PIN_LENGTH, deletes the last one, or clears. Anything else is ignored. Pure. */
export function pinReducer(state: PinState, action: PinAction): PinState {
  switch (action.type) {
    case 'digit':
      if (!/^\d$/.test(action.value) || state.digits.length >= PIN_LENGTH) return state;
      return { digits: state.digits + action.value };
    case 'back':
      return state.digits ? { digits: state.digits.slice(0, -1) } : state;
    case 'clear':
      return state.digits ? EMPTY_PIN : state;
  }
}

export const pinComplete = (state: PinState): boolean => state.digits.length === PIN_LENGTH;
