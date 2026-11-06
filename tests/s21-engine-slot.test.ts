import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createEngineSlot, isStaleLoad } from '../lib/cv/engine-slot.ts';

interface Fake { path: string; disposed: boolean }

/** Loads that resolve when the test says so, in any order. */
function harness() {
  const pending = new Map<string, (e: Fake) => void>();
  const made: Fake[] = [];
  const slot = createEngineSlot<Fake>(
    (path) => new Promise((res) => { pending.set(path, (e) => res(e)); }),
    (e) => { e.disposed = true; },
  );
  const finish = (path: string) => { const e = { path, disposed: false }; made.push(e); pending.get(path)!(e); return e; };
  return { slot, finish, made };
}

test('same path while loading shares one load; a loaded path is served live', async () => {
  const h = harness();
  const a1 = h.slot.get('mine.zip');
  const a2 = h.slot.get('mine.zip');
  h.finish('mine.zip');
  assert.equal(await a1, await a2);
  assert.equal(await h.slot.get('mine.zip'), await a1);
  assert.equal(h.made.length, 1);
});

test('switching mid-load: the older load lands late, is disposed and rejected as stale; the newer stays live', async () => {
  const h = harness();
  const mine = h.slot.get('mine.zip');
  const group = h.slot.get('group.zip');
  const g = h.finish('group.zip');
  assert.equal(await group, g);
  const m = h.finish('mine.zip');
  await assert.rejects(mine, (e) => isStaleLoad(e));
  assert.equal(m.disposed, true);
  assert.equal(g.disposed, false, 'the newer engine is not disposed by the stale one');
  assert.equal(h.slot.livePath(), 'group.zip');
});

test('a stale load finishing never clears the newer in-flight load', async () => {
  const h = harness();
  const mine = h.slot.get('mine.zip');
  const group = h.slot.get('group.zip');
  h.finish('mine.zip');
  await assert.rejects(mine, (e) => isStaleLoad(e));
  // group is still the one in flight: asking again joins it instead of starting a third load
  const again = h.slot.get('group.zip');
  const g = h.finish('group.zip');
  assert.equal(await group, g);
  assert.equal(await again, g);
  assert.equal(h.made.length, 2);
});

test('a newer live engine replaces (and disposes) the previous one', async () => {
  const h = harness();
  const first = h.slot.get('a.zip');
  const a = h.finish('a.zip');
  await first;
  const second = h.slot.get('b.zip');
  h.finish('b.zip');
  await second;
  assert.equal(a.disposed, true);
  assert.equal(h.slot.livePath(), 'b.zip');
});

test('drop disposes the live engine and makes the load in flight stale', async () => {
  const h = harness();
  const first = h.slot.get('a.zip');
  const a = h.finish('a.zip');
  await first;
  const late = h.slot.get('b.zip');
  h.slot.drop();
  assert.equal(a.disposed, true);
  const b = h.finish('b.zip');
  await assert.rejects(late, (e) => isStaleLoad(e));
  assert.equal(b.disposed, true);
  assert.equal(h.slot.livePath(), null);
});
