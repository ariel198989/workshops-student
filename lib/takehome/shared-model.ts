// The take-home page (/model/<token>): what ws_shared_model(p_token) returns, and the plain-Hebrew
// wording of a live guess. Pure: no React, no Supabase, so Node can test it.
import { parseClassStats } from '../cv/readiness.ts';
import type { Decoded } from '../cv/yolo.ts';

/** Same shape ws_shared_model checks before touching the database. */
const TOKEN_RE = /^[a-z2-9]{6,24}$/;
export const isShareToken = (t: string | null | undefined): t is string => typeof t === 'string' && TOKEN_RE.test(t);

export interface SharedModelInfo {
  id: string;
  zip_path: string;
  classes: string[];
  class_stats: unknown;
  accuracy: number | null;
  image_count: number | null;
  created_at: string | null;
}

export interface SharedGroup {
  workshop: string;
  organization: string | null;
  group: string;
  status: string;
  model: SharedModelInfo | null;
}

const str = (v: unknown): string | null => (typeof v === 'string' && v ? v : null);
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);

function normalizeModel(raw: unknown): SharedModelInfo | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const zip = str(r.zip_path);
  const id = str(r.id);
  if (!zip || !id) return null;
  return {
    id, zip_path: zip,
    classes: Array.isArray(r.classes) ? r.classes.filter((c): c is string => typeof c === 'string') : [],
    class_stats: r.class_stats ?? null,
    accuracy: num(r.accuracy),
    image_count: num(r.image_count),
    created_at: str(r.created_at),
  };
}

/** The RPC result; null for a token that matched nothing (or a workshop that is not live/completed). */
export function normalizeShared(raw: unknown): SharedGroup | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const workshop = str(r.workshop);
  const group = str(r.group);
  if (!workshop || !group) return null;
  return { workshop, organization: str(r.organization), group, status: str(r.status) ?? '', model: normalizeModel(r.model) };
}

/** ws_shared_model only answers for live or completed workshops; anything else is "not open" (defensive). */
export const OPEN_STATUSES = ['live', 'completed'] as const;

export type TakeHomeState =
  | { kind: 'bad-token' }
  | { kind: 'not-found' }
  | { kind: 'not-open'; shared: SharedGroup }
  | { kind: 'no-model'; shared: SharedGroup }
  | { kind: 'ready'; shared: SharedGroup; model: SharedModelInfo };

/** The screen to show for a token and the RPC answer. Pure. */
export function takeHomeState(token: string | null | undefined, raw: unknown): TakeHomeState {
  if (!isShareToken(token)) return { kind: 'bad-token' };
  const shared = normalizeShared(raw);
  if (!shared) return { kind: 'not-found' };
  if (!(OPEN_STATUSES as readonly string[]).includes(shared.status)) return { kind: 'not-open', shared };
  if (!shared.model) return { kind: 'no-model', shared };
  return { kind: 'ready', shared, model: shared.model };
}

export const TAKE_HOME_COPY = {
  badToken: 'הקישור לא תקין',
  notFound: 'לא מצאנו את המודל הזה. בדקו את הקישור, או שהסדנה עוד לא נפתחה',
  notOpen: 'הסדנה עוד לא פתוחה. חזרו אחרי יום ההצגה',
  noModel: 'המודל עוד לא מוכן. חזרו אחרי יום ההצגה',
  privacy: 'התמונות לא נשמרות ולא נשלחות לשום מקום',
} as const;

// ── the guess, in plain Hebrew ──

/** 'בטוח מאוד' from 85%, 'די בטוח' from 60%, 'לא בטוח' from 40%, else 'מנחש'. */
export function confidenceWord(score: number): string {
  if (score >= 0.85) return 'בטוח מאוד';
  if (score >= 0.6) return 'די בטוח';
  if (score >= 0.4) return 'לא בטוח';
  return 'מנחש';
}

export const WAITING_GUESS = 'מכוונים את המצלמה לאובייקט';
export const NOTHING_GUESS = 'המחשב לא מזהה כלום כאן';

/** "המחשב חושב: פח, די בטוח" from the strongest box; the nearest guess when nothing passed the threshold. */
export function describeGuess(result: Decoded | null, classes: readonly string[]): string {
  if (!result) return WAITING_GUESS;
  const name = (i: number) => classes[i] ?? `אובייקט ${i + 1}`;
  const best = result.boxes.reduce<Decoded['boxes'][number] | null>((b, x) => (!b || x.score > b.score ? x : b), null);
  if (best) return `המחשב חושב: ${name(best.cls)}, ${confidenceWord(best.score)}`;
  if (result.top) return `${NOTHING_GUESS}. הכי קרוב: ${name(result.top.cls)}`;
  return NOTHING_GUESS;
}

export interface ClassCount { name: string; images: number | null }

/** One line per class, with "X תמונות" from class_stats boxes when the trainer wrote them. */
export function classCounts(classes: readonly string[], classStats: unknown): ClassCount[] {
  const stats = parseClassStats(classStats);
  const byName = new Map(stats.map((s) => [s.name, s.boxes ?? null]));
  const names = classes.length ? classes : stats.map((s) => s.name);
  return names.map((name) => ({ name, images: byName.get(name) ?? null }));
}

export const imagesHe = (n: number): string => (n === 1 ? 'תמונה אחת' : `${n} תמונות`);
