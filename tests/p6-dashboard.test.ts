import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';

const HOOK = `export async function resolve(spec, ctx, next) {
  try { return await next(spec, ctx); }
  catch (e) {
    if (e && e.code === 'ERR_MODULE_NOT_FOUND' && /^\\.\\.?\\//.test(spec)) return next(spec + '.ts', ctx);
    throw e;
  }
}`;
register('data:text/javascript,' + encodeURIComponent(HOOK), import.meta.url);

let D: typeof import('../lib/ws/dashboard.ts');

before(async () => {
  D = await import('../lib/ws/dashboard.ts');
});

const ws = (id: string, status: string, starts_on: string | null) =>
  ({ id, status, starts_on, title: id }) as unknown as import('../lib/ws/workshops.ts').WorkshopWithOrg;

test('myWorkshops puts live first, then upcoming by start date, and hides finished ones', () => {
  const list = [
    ws('done', 'completed', '2026-01-01'), ws('late', 'confirmed', '2026-12-01'), ws('live', 'live', '2026-10-01'),
    ws('soon', 'proposal', '2026-11-01'), ws('nodate', 'draft', null), ws('gone', 'cancelled', '2026-11-05'),
    ws('old', 'archived', null),
  ];
  assert.deepEqual(D.myWorkshops(list).map((w) => w.id), ['live', 'soon', 'late', 'nodate']);
});

test('myWorkshops does not mutate the input', () => {
  const list = [ws('b', 'confirmed', '2026-12-01'), ws('a', 'live', null)];
  const copy = [...list];
  D.myWorkshops(list);
  assert.deepEqual(list, copy);
});

test('weekWindow spans exactly seven days from now', () => {
  const now = new Date('2026-10-18T09:30:00.000Z');
  const w = D.weekWindow(now);
  assert.equal(w.from, '2026-10-18T09:30:00.000Z');
  assert.equal(w.to, '2026-10-25T09:30:00.000Z');
});

test('isNewInstall is true only when there are no orgs and no workshops', () => {
  assert.equal(D.isNewInstall({ orgs: 0, workshops: 0 }), true);
  assert.equal(D.isNewInstall({ orgs: 1, workshops: 0 }), false);
  assert.equal(D.isNewInstall({ orgs: 0, workshops: 2 }), false);
});

test('matchModels keeps only models of existing groups and resolves the group', () => {
  const groups = [
    { id: 'g1', number: 1, display_name: null, team_name: 'ח1 · קבוצה 1', workshop_id: 'w1' },
    { id: 'g2', number: 2, display_name: 'נשרים', team_name: 'ח1 · קבוצה 2', workshop_id: 'w1' },
  ];
  const models = [
    { id: 'm1', team_name: 'ח1 · קבוצה 1', name: 'a', accuracy: 0.9, image_count: 10, approved: true, created_at: '2026-10-01' },
    { id: 'm2', team_name: 'אישי · ח1 · קבוצה 2', name: 'b', accuracy: null, image_count: null, approved: false, created_at: '2026-10-02' },
    { id: 'm3', team_name: 'עיר אחרת', name: 'c', accuracy: 0.5, image_count: 1, approved: false, created_at: '2026-10-03' },
  ];
  const rows = D.matchModels(models, groups);
  assert.deepEqual(rows.map((r) => [r.model.id, r.group.id, r.personal]), [['m1', 'g1', false], ['m2', 'g2', true]]);
});

test('matchModels returns nothing when there are no groups', () => {
  assert.deepEqual(D.matchModels([{ id: 'm', team_name: 'x', name: 'n', accuracy: 1, image_count: 1, approved: true, created_at: '' }], []), []);
});

test('accuracyPercent formats 0..1 as a whole percent and handles null', () => {
  assert.equal(D.accuracyPercent(0.8349), '83%');
  assert.equal(D.accuracyPercent(1), '100%');
  assert.equal(D.accuracyPercent(null), '');
});

test('relativeTime reads naturally in Hebrew', async () => {
  const { relativeTime } = await import('../components/ws/p6/format.ts');
  const now = new Date('2026-10-18T12:00:00.000Z');
  assert.equal(relativeTime('2026-10-18T11:59:30.000Z', now), 'עכשיו');
  assert.equal(relativeTime('2026-10-18T11:55:00.000Z', now), 'לפני 5 דק׳');
  assert.equal(relativeTime('2026-10-18T09:00:00.000Z', now), 'לפני 3 שע׳');
  assert.equal(relativeTime('2026-10-17T09:00:00.000Z', now), 'אתמול');
  assert.equal(relativeTime('2026-10-15T09:00:00.000Z', now), 'לפני 3 ימים');
  assert.equal(relativeTime('garbage', now), '');
});
