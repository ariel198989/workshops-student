// The facilitator's "now we are doing X" (ws_live_state), as the student app reads it. Pure: no React,
// no Supabase, so Node can test it. The realtime hook that feeds it lives in ./live-sync.ts.
import { decideRoute } from './access.ts';
import type { StudentCaps } from './caps.ts';
import type { StudentProgress } from './context';
import { pickNextStep, type NextStep } from './next-step.ts';

/** Route keys the facilitator may open (ws_set_live_step checks the same list). */
export const LIVE_ROUTES = ['capture', 'tag', 'train', 'results', 'check', 'certificate'] as const;
export type LiveRoute = (typeof LIVE_ROUTES)[number];

export interface LiveState {
  session_module_id: string | null;
  step_key: string | null;
  label: string | null;
  allowed_routes: LiveRoute[];
  message: string | null;
  updated_at: string;
}

const isLiveRoute = (v: unknown): v is LiveRoute => typeof v === 'string' && (LIVE_ROUTES as readonly string[]).includes(v);
const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v : null);

/** ws_my_context.live or a realtime row of ws_live_state; anything malformed becomes null (no lock). */
export function normalizeLive(raw: unknown): LiveState | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const routes = Array.isArray(r.allowed_routes) ? r.allowed_routes.filter(isLiveRoute) : [];
  return {
    session_module_id: str(r.session_module_id),
    step_key: str(r.step_key),
    label: str(r.label),
    allowed_routes: [...new Set(routes)],
    message: str(r.message),
    updated_at: str(r.updated_at) ?? '',
  };
}

/** The live-gated route of a path: the five cycle routes plus /certificate. Home, join and verify are never gated. */
export function liveRouteOf(pathname: string | null): LiveRoute | null {
  if (!pathname) return null;
  const [, first] = pathname.split('/');
  return isLiveRoute(first) ? first : null;
}

/** No live state → everything open. A route the lock does not know → open. Else it must be in allowed_routes. */
export function liveAllows(live: LiveState | null, route: string | null): boolean {
  if (!live) return true;
  if (!isLiveRoute(route)) return true;
  return live.allowed_routes.includes(route);
}

export interface LiveBanner { label: string; message: string | null }

/** What the slim bar under the top bar shows; null when there is nothing to say. */
export function liveBanner(live: LiveState | null): LiveBanner | null {
  if (!live) return null;
  const label = live.label ?? (live.step_key ? STEP_TITLES[live.step_key]?.title ?? null : null);
  if (!label && !live.message) return null;
  return { label: label ?? 'המדריך מוביל', message: live.message };
}

export const liveBlockedReason = (live: LiveState): string =>
  `המדריך יפתח את זה עוד רגע. עכשיו: ${liveBanner(live)?.label ?? 'המדריך מוביל'}`;

export type LiveRouteDecision = { allowed: true } | { allowed: false; reason: string };

/** May the student be on this path right now? Pure. */
export function decideLiveRoute(pathname: string | null, live: LiveState | null): LiveRouteDecision {
  const route = liveRouteOf(pathname);
  if (!live || !route || liveAllows(live, route)) return { allowed: true };
  return { allowed: false, reason: liveBlockedReason(live) };
}

const STEP_TITLES: Readonly<Record<string, { title: string; hint: string; href: string }>> = {
  capture: { title: 'צלמו עכשיו', hint: 'המדריך פתח את הצילום', href: '/capture' },
  tag: { title: 'תייגו עכשיו', hint: 'המדריך פתח את התיוג', href: '/tag' },
  train: { title: 'אמנו את המודל', hint: 'המדריך פתח את האימון', href: '/train' },
  results: { title: 'בדקו את המודל', hint: 'המדריך פתח את התוצאות', href: '/results' },
  check: { title: 'ענו על השאלון', hint: 'המדריך פתח את בדיקת המושגים', href: '/check' },
  certificate: { title: 'התעודה שלכם מחכה', hint: 'המדריך פתח את התעודות', href: '/certificate' },
};

const WATCH: NextStep = { title: 'עוקבים אחרי המדריך', hint: 'המסך הגדול מוביל עכשיו', href: '/' };

/** The step the facilitator broadcast, as a home card: a Hebrew verb and the route; home when the step has no screen. */
export function liveNextStep(live: LiveState): NextStep {
  const known = live.step_key ? STEP_TITLES[live.step_key] : undefined;
  const hint = live.message ?? live.label ?? null;
  if (known && liveAllows(live, live.step_key)) return { ...known, hint: hint ?? known.hint };
  const title = live.label ? `עכשיו: ${live.label}` : WATCH.title;
  return { title, hint: live.message ?? WATCH.hint, href: '/' };
}

/**
 * The home card: the facilitator's live step wins over the computed next step, unless this workshop's
 * caps keep that route closed to students (then the computed step, which already respects caps).
 */
export function pickHomeStep(progress: StudentProgress | null, caps: StudentCaps, live: LiveState | null, checksCount = 0): NextStep {
  if (!live) return pickNextStep(progress, caps);
  const step = liveNextStep(live);
  if (step.href !== '/' && !decideRoute(step.href, caps, checksCount).allowed) return pickNextStep(progress, caps);
  return step;
}
