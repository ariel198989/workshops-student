// One-scan sign-in: the group's QR points at /g/<join_token>; the token alone is exchanged at
// ws-device-login for the group device credentials. Pure except for the POST (fetch is injectable).
// The sign-in that follows lives in ./device-login-flow.ts (joinTokenLogin).
import {
  DeviceLoginError, deviceLoginErrorMessage, OFFLINE, postDeviceLogin, SERVER_UNAVAILABLE,
  type DeviceLoginOk, type FetchLike,
} from './device-login.ts';

export const JOIN_TOKEN_LENGTH = 20;
const TOKEN_RE = /^[a-z2-9]{20}$/;

/** Same shape the console mints and the edge function checks before touching the database. */
export const isJoinToken = (t: string | null | undefined): t is string => typeof t === 'string' && TOKEN_RE.test(t);

/** URL segment → candidate token: decoded, trimmed, lowercased. Never throws. */
export function normalizeJoinToken(raw: string | null | undefined): string {
  if (!raw) return '';
  let decoded = raw;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    decoded = raw;
  }
  return decoded.trim().toLowerCase();
}

// ── Hebrew for the /g screen ──
export const CONNECTING = 'מתחברים לקבוצה...';
export const LINK_INACTIVE = 'הקישור לא פעיל. בקשו מהמדריך קוד חדש';
export const LINK_INVALID = 'הקישור לא תקין. בקשו מהמדריך קוד חדש';
export const SIGN_IN_FAILED = 'הכניסה לא הצליחה. בקשו מהמדריך לבדוק את הקבוצה ונסו שוב';
export const WELCOME_MS = 1000;

/** "מחוברים! ברוכים הבאים לקבוצה 3": a label that already starts with קבוצה is not doubled. */
export function welcomeMessage(label: string | null | undefined): string {
  const clean = (label ?? '').trim().replace(/^קבוצה\s+/u, '');
  return clean ? `מחוברים! ברוכים הבאים לקבוצה ${clean}` : 'מחוברים! ברוכים הבאים לקבוצה';
}

/** 404 covers both not_found and not_live: for a scanned link the fix is the same, a fresh code from the facilitator. */
export function joinTokenErrorMessage(status: number, body: unknown): string {
  if (status === 404) return LINK_INACTIVE;
  if (status === 400) return LINK_INVALID;
  return deviceLoginErrorMessage(status, body);
}

/** join_token → credentials. A malformed token never leaves the device. */
export async function requestJoinTokenLogin(token: string, fetchImpl: FetchLike = fetch): Promise<DeviceLoginOk> {
  if (!isJoinToken(token)) throw new DeviceLoginError(LINK_INVALID, 'bad_request');
  return postDeviceLogin({ join_token: token }, joinTokenErrorMessage, fetchImpl);
}

// ── what the screen does with a failure ──
export interface JoinLinkFailure {
  message: string;
  /** offer "נסו שוב" (the link itself may still be fine) */
  retry: boolean;
  /** offer the manual code + PIN entry */
  manual: boolean;
}

export const INVALID_LINK_FAILURE: JoinLinkFailure = { message: LINK_INVALID, retry: false, manual: true };

/** Maps any thrown value to the buttons the /g screen shows. Pure. */
export function joinLinkFailure(err: unknown): JoinLinkFailure {
  if (!(err instanceof DeviceLoginError)) return { message: SERVER_UNAVAILABLE, retry: true, manual: true };
  switch (err.kind) {
    case 'network': return { message: err.message || OFFLINE, retry: true, manual: false };
    case 'not_found': case 'bad_request': return { message: err.message, retry: false, manual: true };
    case 'locked': return { message: err.message, retry: false, manual: false };
    default: return { message: err.message, retry: true, manual: true };
  }
}
