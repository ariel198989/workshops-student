import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  agendaId, clearProgress, decodeProgress, emptyProgress, isAgendaDone, isModuleDone, loadProgress, nextUndone,
  progressKey, resetModule, saveProgress, toggleAgenda, toggleModule,
} from '../lib/facilitator/progress.ts';
import type { StorageLike } from '../lib/pocket/store.ts';
import { groupModules, type ModuleRow } from '../lib/facilitator/guide.ts';

function memoryStorage(): StorageLike & { map: Map<string, string> } {
  const map = new Map<string, string>();
  return {
    map,
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => { map.set(k, v); },
    removeItem: (k) => { map.delete(k); },
  };
}

test('ticks toggle immutably and round-trip through storage per workshop', () => {
  const st = memoryStorage();
  const a = agendaId('m1', 0);
  assert.equal(a, 'm1:0');
  const p0 = emptyProgress();
  const p1 = toggleAgenda(p0, a);
  assert.deepEqual(p0, emptyProgress(), 'toggle must not mutate');
  assert.equal(isAgendaDone(p1, a), true);
  const p2 = toggleModule(p1, 'm1');
  assert.equal(isModuleDone(p2, 'm1'), true);
  assert.equal(saveProgress('w1', p2, st), true);
  assert.equal(progressKey('w1'), 'ws_guide_v1:w1');
  assert.deepEqual(loadProgress('w1', st), p2);
  assert.deepEqual(loadProgress('w2', st), emptyProgress());
  // explicit on/off and double-toggle
  assert.equal(isAgendaDone(toggleAgenda(p2, a), a), false);
  assert.equal(isAgendaDone(toggleAgenda(p2, a, true), a), true);
  assert.deepEqual(toggleAgenda(p2, a, true).agenda, ['m1:0'], 'no duplicates');
  clearProgress('w1', st);
  assert.deepEqual(loadProgress('w1', st), emptyProgress());
});

test('resetModule drops only that module\'s ticks; nextUndone finds the first unchecked', () => {
  let p = emptyProgress();
  p = toggleAgenda(p, agendaId('m1', 0));
  p = toggleAgenda(p, agendaId('m1', 1));
  p = toggleAgenda(p, agendaId('m2', 0));
  p = toggleModule(p, 'm1');
  const r = resetModule(p, 'm1');
  assert.deepEqual(r, { agenda: ['m2:0'], modules: [] });
  const items = [{ id: 'm1:0' }, { id: 'm1:1' }, { id: 'm1:2' }];
  assert.equal(nextUndone(items, p)?.id, 'm1:2');
  assert.equal(nextUndone(items, toggleAgenda(p, 'm1:2')), null);
});

test('decode rejects corrupt json and foreign shapes', () => {
  assert.deepEqual(decodeProgress(null), emptyProgress());
  assert.deepEqual(decodeProgress('{bad'), emptyProgress());
  assert.deepEqual(decodeProgress('[1,2]'), emptyProgress());
  assert.deepEqual(decodeProgress('{"agenda":["a",1,null],"modules":"x"}'), { agenda: ['a'], modules: [] });
});

test('storage failures are swallowed', () => {
  const broken: StorageLike = {
    getItem: () => { throw new Error('blocked'); },
    setItem: () => { throw new Error('full'); },
    removeItem: () => { throw new Error('blocked'); },
  };
  assert.equal(saveProgress('w', emptyProgress(), broken), false);
  assert.deepEqual(loadProgress('w', broken), emptyProgress());
  assert.doesNotThrow(() => clearProgress('w', broken));
  assert.equal(saveProgress('w', emptyProgress(), null), false);
});

test('groupModules keeps position order inside each session', () => {
  const m = (id: string, session_id: string, position: number): ModuleRow =>
    ({ id, session_id, workshop_id: 'w', position, title: id, module_type: null, duration_minutes: null, pipeline_stage: null, content: null });
  const g = groupModules([m('a', 's1', 1), m('b', 's2', 1), m('c', 's1', 2)]);
  assert.deepEqual(Object.keys(g), ['s1', 's2']);
  assert.deepEqual(g.s1.map((x) => x.id), ['a', 'c']);
});
