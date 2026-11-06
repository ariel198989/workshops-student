// Pure helpers for the capture screen: class-name validation, image sizing,
// the variety coach, and an in-memory upload retry queue. (File paths: ./ws-data.)

export const MAX_CLASS_NAME = 40;
export const MAX_SIDE = 1280;
export const JPEG_QUALITY = 0.8;
export const SERIES_INTERVAL_MS = 1500;
/** Goals shown next to the live per-class count. */
export const TARGET_FIRST = 50;
export const TARGET_STRONG = 150;

export const randomSuffix = (): string => Math.random().toString(36).slice(2, 7).padEnd(5, '0');

// "שתיים X" (standalone) is wrong before a feminine plural; construct form is "שתי X".
export const normalizeHebrewCount = (label: string): string => label.replace(/(^|\s)שתיים(?=\s)/g, '$1שתי');

export type NameCheck = { ok: true; name: string } | { ok: false; reason: string };

export function validateClassName(raw: string): NameCheck {
  const name = normalizeHebrewCount(raw.trim());
  if (!name) return { ok: false, reason: 'כתבו שם לאובייקט.' };
  if (name.length > MAX_CLASS_NAME) return { ok: false, reason: `השם ארוך מדי (עד ${MAX_CLASS_NAME} תווים).` };
  if (/['"\r\n]/.test(name)) return { ok: false, reason: 'בלי גרשיים ובלי ירידת שורה בשם.' };
  return { ok: true, name };
}

/** Shrink so the long side is at most `max`; never upscale. */
export function fitWithin(w: number, h: number, max: number): { w: number; h: number } {
  const longSide = Math.max(w, h);
  if (longSide <= max) return { w, h };
  const k = max / longSide;
  return { w: Math.round(w * k), h: Math.round(h * k) };
}

export const COACH_TIPS: readonly string[] = [
  'זווית אחרת',
  'קרוב יותר',
  'רקע אחר',
  'תאורה אחרת',
  'רחוק יותר',
  'האובייקט במקום אחר בפריים',
];
const TIP_EVERY = 5;

export function coachTip(shotCount: number): string {
  const step = Math.floor(Math.max(0, shotCount) / TIP_EVERY);
  return COACH_TIPS[step % COACH_TIPS.length];
}

/** Only our own Hebrew messages reach the student; raw database/network text never does. */
export function friendlyError(e: unknown, fallback = 'משהו השתבש. נסו שוב בעוד רגע'): string {
  const msg = e instanceof Error ? e.message : '';
  return /[֐-׿]/.test(msg) ? msg : fallback;
}

export function mergeCounts(a: Record<string, number>, b: Record<string, number>): Record<string, number> {
  const out: Record<string, number> = { ...a };
  for (const [k, v] of Object.entries(b)) out[k] = (out[k] ?? 0) + v;
  return out;
}

/**
 * Storage answering "this object already exists" (409 / Duplicate) means an earlier
 * attempt landed and only the response was lost: the upload is done, not failed.
 */
export function isAlreadyUploaded(e: unknown): boolean {
  if (!e || typeof e !== 'object') return false;
  const { statusCode, status, message } = e as { statusCode?: unknown; status?: unknown; message?: unknown };
  if (String(statusCode ?? '') === '409' || String(status ?? '') === '409') return true;
  return typeof message === 'string' && /already exists|duplicate/i.test(message);
}

/** The database takes photos only while the workshop is live (RLS on ws_photos and on ws-media uploads). */
export const WORKSHOP_NOT_LIVE = 'הסדנה לא פעילה כרגע, אפשר לצלם רק בזמן מפגש';

/** Capture is open only during a live workshop (ws_my_context: workshop.status). */
export const captureAllowed = (workshopStatus: unknown): boolean => workshopStatus === 'live';

/**
 * The database refusing a photo by policy: Postgres 42501 on the ws_photos insert, or Storage's
 * "new row violates row-level security policy" (HTTP 403) on the ws-media upload. Since the
 * workshop-must-be-live rule, that is what a capture outside a session gets.
 */
export function isNotLiveRejection(e: unknown): boolean {
  if (!e || typeof e !== 'object') return false;
  const { code, message } = e as { code?: unknown; message?: unknown };
  if (String(code ?? '') === '42501') return true;
  return typeof message === 'string' && /row[- ]level security/i.test(message);
}

/** Consecutive failures of the same head item before the UI says the photo itself is stuck. */
export const STUCK_AFTER = 3;
export const STUCK_HINT = 'התמונה לא עולה. בדקו רשת ונסו שוב';

export interface QueueStats {
  queued: number;
  saved: number;
  failing: boolean;
  dropped: number;
  /** how many times in a row the current head item failed; 0 once anything is saved */
  failures: number;
  /** the message of the head item's last failure; null while nothing is failing */
  error: string | null;
}

export const uploadStuck = (s: QueueStats): boolean => s.failing && s.failures >= STUCK_AFTER;

export interface RetryQueue<T> {
  submit: (item: T) => boolean;
  retryNow: () => Promise<void>;
  idle: () => Promise<void>;
  stats: () => QueueStats;
}

/**
 * Sequential in-memory queue. A failed item stays at the head and blocks the
 * rest (order is kept); the next submit or retryNow() tries again. Beyond
 * `max` queued items new ones are refused so a long offline stretch cannot
 * exhaust phone memory.
 */
export function createRetryQueue<T>(
  save: (item: T) => Promise<void>,
  opts: { max?: number; onChange?: (s: QueueStats) => void } = {},
): RetryQueue<T> {
  const max = opts.max ?? 80;
  const items: T[] = [];
  let saved = 0;
  let dropped = 0;
  let failing = false;
  let failures = 0;
  let error: string | null = null;
  let running: Promise<void> | null = null;

  const stats = (): QueueStats => ({ queued: items.length, saved, failing, dropped, failures, error });
  const notify = () => opts.onChange?.(stats());

  async function drain(): Promise<void> {
    while (items.length) {
      try {
        await save(items[0]);
        items.shift();
        saved += 1;
        failing = false;
        failures = 0;
        error = null;
        notify();
      } catch (e) {
        failing = true;
        failures += 1;
        error = e instanceof Error ? e.message : String(e);
        notify();
        return;
      }
    }
  }

  function pump(): Promise<void> {
    if (!running) running = drain().finally(() => { running = null; });
    return running;
  }

  return {
    submit(item) {
      if (items.length >= max) { dropped += 1; notify(); return false; }
      items.push(item);
      notify();
      void pump();
      return true;
    },
    async retryNow() { await pump(); },
    async idle() { while (running) await running; },
    stats,
  };
}
