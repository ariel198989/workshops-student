import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  EMPTY_MINE, normalizeMine, normalizePoolScope, normalizeUserId, personalProgress, poolUser, progressForScope, scopeOf, untaggedOf,
  type MyStats,
} from '../lib/student/scope.ts';
import type { StudentProgress } from '../lib/student/context.ts';

const mine = (over: Partial<MyStats> = {}): MyStats => ({ ...EMPTY_MINE, ...over });

const groupProgress = (over: Partial<StudentProgress> = {}): StudentProgress => ({
  photos: 120, tagged: 90, untagged: 30, today: 7, contributors: 4,
  coverage: [{ name: 'כובע', tagged: 60 }], off_target_classes: [], readiness: 'ok',
  jobs: { pending: 1, running: 1, done: 2, last: null },
  model: { id: 'm1', name: 'm', accuracy: 0.8, approved: true, image_count: 100, honest_val: true, class_stats: null, personal: false, created_at: '2026-10-01' },
  ...over,
});

// ── normalisation ──

test('pool_scope defaults to personal; only the literal group opts out', () => {
  assert.equal(normalizePoolScope('group'), 'group');
  assert.equal(normalizePoolScope('personal'), 'personal');
  assert.equal(normalizePoolScope(undefined), 'personal');
  assert.equal(normalizePoolScope('GROUP'), 'personal');
  assert.equal(normalizePoolScope(null), 'personal');
});

test('user_id is a non-empty string or null', () => {
  assert.equal(normalizeUserId('u1'), 'u1');
  assert.equal(normalizeUserId(''), null);
  assert.equal(normalizeUserId(undefined), null);
  assert.equal(normalizeUserId(42), null);
});

test('normalizeMine: zeros and no job for a missing or malformed payload', () => {
  assert.deepEqual(normalizeMine(undefined), EMPTY_MINE);
  assert.deepEqual(normalizeMine('x'), EMPTY_MINE);
  assert.deepEqual(normalizeMine({ photos: -3, tagged: 'a', models: null, active_job: 'done' }), EMPTY_MINE);
  assert.deepEqual(normalizeMine({ photos: 12.9, tagged: 5, models: 1, active_job: 'running' }),
    { photos: 12, tagged: 5, models: 1, active_job: 'running' });
  assert.equal(normalizeMine({ active_job: 'pending' }).active_job, 'pending');
});

// ── scopeOf / poolUser ──

test('scopeOf: personal by default, group only when the workshop says so; the user id comes from me', () => {
  assert.deepEqual(scopeOf(null), { personal: true, userId: null });
  assert.deepEqual(scopeOf({ workshop: {}, me: {} }), { personal: true, userId: null });
  assert.deepEqual(scopeOf({ workshop: { pool_scope: 'personal' }, me: { user_id: 'u1' } }), { personal: true, userId: 'u1' });
  assert.deepEqual(scopeOf({ workshop: { pool_scope: 'group' }, me: { user_id: 'u1' } }), { personal: false, userId: 'u1' });
});

test('poolUser: the queries filter on me in personal scope and on nobody in group scope', () => {
  assert.equal(poolUser({ personal: true }, 'u1'), 'u1');
  assert.equal(poolUser({ personal: false }, 'u1'), null);
});

test('untaggedOf never goes negative', () => {
  assert.equal(untaggedOf(mine({ photos: 10, tagged: 4 })), 6);
  assert.equal(untaggedOf(mine({ photos: 3, tagged: 5 })), 0);
  assert.equal(untaggedOf(EMPTY_MINE), 0);
});

// ── the home screen's progress ──

test('personalProgress replaces the group counts with mine and drops the per-class coverage', () => {
  const p = personalProgress(groupProgress(), mine({ photos: 20, tagged: 12, models: 1, active_job: 'pending' }));
  assert.equal(p.photos, 20);
  assert.equal(p.tagged, 12);
  assert.equal(p.untagged, 8);
  assert.equal(p.contributors, 1);
  assert.deepEqual(p.coverage, []);
  assert.deepEqual(p.off_target_classes, []);
  assert.equal(p.jobs.pending, 1);
  assert.equal(p.jobs.running, 0);
  assert.equal(p.jobs.done, 2, 'the group history is kept where I have no own figure');
  assert.equal(p.model?.id, 'm1', 'I own a model, so the model row stays');
});

test('personalProgress: no model of mine means no model, even when the group has one', () => {
  assert.equal(personalProgress(groupProgress(), mine({ photos: 5 })).model, null);
  assert.equal(personalProgress(groupProgress(), mine({ photos: 5, active_job: 'running' })).jobs.running, 1);
});

test('personalProgress works without any group progress', () => {
  const p = personalProgress(null, mine({ photos: 2, tagged: 1 }));
  assert.equal(p.photos, 2);
  assert.equal(p.readiness, 'no_targets');
  assert.deepEqual(p.jobs, { pending: 0, running: 0, done: 0, last: null });
  assert.equal(p.model, null);
});

test('progressForScope hands back the group progress untouched in group scope', () => {
  const g = groupProgress();
  assert.equal(progressForScope({ personal: false }, g, mine({ photos: 1 })), g);
  assert.equal(progressForScope({ personal: true }, g, mine({ photos: 1 }))?.photos, 1);
});

test('hasGroupModel: only an approved model with scope group counts', async () => {
  const { hasGroupModel } = await import('../lib/student/scope.ts');
  const m = (over: Record<string, unknown>) => ({ model: { id: 'm', approved: true, scope: 'group', ...over } }) as never;
  assert.equal(hasGroupModel(m({})), true);
  assert.equal(hasGroupModel(m({ approved: false })), false);
  assert.equal(hasGroupModel(m({ scope: 'personal' })), false);
  assert.equal(hasGroupModel(m({ scope: undefined })), false);
  assert.equal(hasGroupModel({ model: null }), false);
  assert.equal(hasGroupModel(null), false);
});
