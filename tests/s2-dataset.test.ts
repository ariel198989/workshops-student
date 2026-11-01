import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  groupKey, splitValGroups, classIndexMap, orderQueue, teamScope, pickTeamModel, pickOwnModel, pickScopedModels, countByClass,
} from '../lib/cv/dataset.ts';

const T0 = Date.parse('2026-10-18T10:00:00Z');
const row = (cls: string, by: string, minutes: number) => ({
  class_name: cls, detected_by: by, created_at: new Date(T0 + minutes * 60000).toISOString(),
});

test('teamScope covers the group and its members personal pool', () => {
  assert.deepEqual(teamScope('ח1'), ['ח1', 'אישי · ח1']);
});

test('groupKey puts a burst by one shooter of one class in the same 10-minute bucket', () => {
  assert.equal(groupKey(row('a', 'u1', 0)), groupKey(row('a', 'u1', 5)));
  assert.notEqual(groupKey(row('a', 'u1', 0)), groupKey(row('a', 'u1', 25)));
  assert.notEqual(groupKey(row('a', 'u1', 0)), groupKey(row('a', 'u2', 0)));
  assert.notEqual(groupKey(row('a', 'u1', 0)), groupKey(row('b', 'u1', 0)));
});

test('splitValGroups never empties the train side of a class', () => {
  // class "a": 1 group -> stays in train. class "b": 5 groups -> some go to val, not all.
  const rows = [
    row('a', 'u1', 0),
    ...[0, 20, 40, 60, 80].map((m) => row('b', 'u1', m)),
  ];
  const val = splitValGroups(rows);
  assert.equal(val.has(groupKey(rows[0])), false);
  const bGroups = new Set(rows.slice(1).map(groupKey));
  const bVal = [...bGroups].filter((g) => val.has(g));
  assert.ok(bVal.length >= 1 && bVal.length < bGroups.size);
});

test('splitValGroups with two groups holds out exactly one', () => {
  const rows = [row('a', 'u1', 0), row('a', 'u1', 30)];
  assert.equal(splitValGroups(rows).size, 1);
});

test('classIndexMap numbers classes in first-seen order', () => {
  const { names, idx } = classIndexMap([row('b', 'u', 0), row('a', 'u', 1), row('b', 'u', 2)]);
  assert.deepEqual(names, ['b', 'a']);
  assert.equal(idx['a'], 1);
});

test('orderQueue puts my frames first, newest first inside each part', () => {
  const rows = [
    { id: '1', detected_by: 'mate', created_at: '2026-10-18T10:05:00Z' },
    { id: '2', detected_by: 'me', created_at: '2026-10-18T10:01:00Z' },
    { id: '3', detected_by: 'me', created_at: '2026-10-18T10:03:00Z' },
    { id: '4', detected_by: 'mate', created_at: '2026-10-18T10:06:00Z' },
  ];
  assert.deepEqual(orderQueue(rows, 'me').map((r) => r.id), ['3', '2', '4', '1']);
});

test('countByClass tallies rows per class', () => {
  assert.deepEqual(countByClass([{ class_name: 'a' }, { class_name: 'b' }, { class_name: 'a' }]), { a: 2, b: 1 });
});

const model = (over: Record<string, unknown>) => ({
  id: 'm', owner: 'someone', team_name: 'other', name: 'n', classes: [], zip_path: 'models/x.zip',
  approved: true, scope: 'team', ...over,
});

test('pickTeamModel takes the newest approved model of the group, its personal pool or mine', () => {
  const models = [
    model({ id: 'city', scope: 'city' }),
    model({ id: 'unapproved', team_name: 'ח1', approved: false }),
    model({ id: 'nozip', team_name: 'ח1', zip_path: '' }),
    model({ id: 'personal', team_name: 'אישי · ח1' }),
    model({ id: 'team', team_name: 'ח1' }),
  ];
  assert.equal(pickTeamModel(models, 'me', 'ח1')?.id, 'personal');
  assert.equal(pickTeamModel(models.slice(0, 3), 'me', 'ח1'), null);
  assert.equal(pickTeamModel([model({ id: 'mine', owner: 'me' })], 'me', 'ח1')?.id, 'mine');
});

test('pickOwnModel takes only the newest approved model with owner = me', () => {
  const models = [
    model({ id: 'mine-unapproved', owner: 'me', approved: false }),
    model({ id: 'mine-nozip', owner: 'me', zip_path: null }),
    model({ id: 'team', team_name: 'ח1' }),
    model({ id: 'mine', owner: 'me', team_name: 'ח1' }),
    model({ id: 'mine-older', owner: 'me', team_name: 'ח1' }),
  ];
  assert.equal(pickOwnModel(models, 'me')?.id, 'mine');
  assert.equal(pickOwnModel(models.slice(0, 3), 'me'), null);
});

test('pickScopedModels: personal scope shows mine first and the group model by someone else quieter', () => {
  const models = [
    model({ id: 'mate', owner: 'mate', team_name: 'ח1' }),
    model({ id: 'mine', owner: 'me', team_name: 'ח1' }),
    model({ id: 'merged', owner: null, team_name: 'ח1' }),
  ];
  const personal = pickScopedModels(models, 'me', 'ח1', true);
  assert.equal(personal.model?.id, 'mine');
  assert.equal(personal.group?.id, 'mate', 'the newest model that is not mine');
  // no model of mine: the group's one (here a merged model with no owner) is the only thing on offer, folded away
  const noMine = pickScopedModels(models.filter((m) => m.id !== 'mine' && m.id !== 'mate'), 'me', 'ח1', true);
  assert.equal(noMine.model, null);
  assert.equal(noMine.group?.id, 'merged');
  // group scope: today's behaviour, nothing in the quiet slot
  const group = pickScopedModels(models, 'me', 'ח1', false);
  assert.equal(group.model?.id, 'mate');
  assert.equal(group.group, null);
});
