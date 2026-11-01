// Pool scope: does each student work on their own photos (personal, the default) or on the
// whole group's (group)? Pure: no React or Supabase, so Node can test it. ws_my_context sends
// workshop.pool_scope, me.user_id and `mine` (migration 0016); older servers send none of them.
import type { StudentProgress } from './context';

export type PoolScope = 'personal' | 'group';

/** The signed-in student's own counts inside the group's team names (ws_internal_my_stats). */
export interface MyStats {
  photos: number;
  tagged: number;
  /** approved models with owner = me */
  models: number;
  active_job: null | 'pending' | 'running';
}

export const EMPTY_MINE: MyStats = { photos: 0, tagged: 0, models: 0, active_job: null };

export interface Scope {
  /** true: every count, queue, ZIP, job list and model is this student's own */
  personal: boolean;
  /** auth.users id the server attached to the context; null before migration 0016 */
  userId: string | null;
}

const count = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.floor(v) : 0);

export const normalizePoolScope = (raw: unknown): PoolScope => (raw === 'group' ? 'group' : 'personal');

export const normalizeUserId = (raw: unknown): string | null => (typeof raw === 'string' && raw ? raw : null);

/** Anything malformed becomes zero counts and no job. */
export function normalizeMine(raw: unknown): MyStats {
  if (!raw || typeof raw !== 'object') return EMPTY_MINE;
  const r = raw as Record<string, unknown>;
  const job = r.active_job === 'pending' || r.active_job === 'running' ? r.active_job : null;
  return { photos: count(r.photos), tagged: count(r.tagged), models: count(r.models), active_job: job };
}

interface ScopedContext { workshop: { pool_scope?: PoolScope }; me: { user_id?: string | null } }

/** The scope of a loaded context; a missing context or an older server means personal with no user id. */
export function scopeOf(ctx: ScopedContext | null | undefined): Scope {
  return {
    personal: normalizePoolScope(ctx?.workshop?.pool_scope) === 'personal',
    userId: normalizeUserId(ctx?.me?.user_id),
  };
}

/** The user the sc_* queries filter on: me in personal scope, nobody (the whole group) otherwise. */
export const poolUser = (scope: Pick<Scope, 'personal'>, userId: string): string | null => (scope.personal ? userId : null);

/** Photos of mine that still wait for a box. */
export const untaggedOf = (mine: MyStats): number => Math.max(0, mine.photos - mine.tagged);

/**
 * The group's progress with my own counts in place of the group's, for the home card that picks the next step.
 * Per-class coverage is a group figure the server does not split per student, so it is dropped: readiness then
 * follows my tagged total. `model` stays the group's row only when I own a model myself.
 */
export function personalProgress(progress: StudentProgress | null, mine: MyStats): StudentProgress {
  const jobs = progress?.jobs ?? { pending: 0, running: 0, done: 0, last: null };
  return {
    photos: mine.photos,
    tagged: mine.tagged,
    untagged: untaggedOf(mine),
    today: progress?.today ?? 0,
    contributors: 1,
    coverage: [],
    off_target_classes: [],
    readiness: progress?.readiness ?? 'no_targets',
    jobs: {
      ...jobs,
      pending: mine.active_job === 'pending' ? 1 : 0,
      running: mine.active_job === 'running' ? 1 : 0,
    },
    model: mine.models > 0 ? progress?.model ?? null : null,
  };
}

/** The progress the home screen reasons about: mine in personal scope, the group's otherwise. */
export function progressForScope(scope: Pick<Scope, 'personal'>, progress: StudentProgress | null, mine: MyStats): StudentProgress | null {
  return scope.personal ? personalProgress(progress, mine) : progress;
}
