// Pure helpers for the capture screen: file naming, class-name validation,
// image sizing, the variety coach, and an in-memory upload retry queue.

export const MAX_CLASS_NAME = 40;
export const MAX_SIDE = 1280;
export const JPEG_QUALITY = 0.8;
export const SERIES_INTERVAL_MS = 1500;
/** Goals shown next to the live per-class count. */
export const TARGET_FIRST = 50;
export const TARGET_STRONG = 150;

/** ASCII-only storage key in the shared `smartcity` bucket (ws_ marks workshop shots). */
export function captureFilename(now: number, rand: string): string {
  return `pool/ws_${now}_${rand}.jpg`;
}

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

export interface QueueStats { queued: number; saved: number; failing: boolean; dropped: number }

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
  let running: Promise<void> | null = null;

  const stats = (): QueueStats => ({ queued: items.length, saved, failing, dropped });
  const notify = () => opts.onChange?.(stats());

  async function drain(): Promise<void> {
    while (items.length) {
      try {
        await save(items[0]);
        items.shift();
        saved += 1;
        failing = false;
        notify();
      } catch {
        failing = true;
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
