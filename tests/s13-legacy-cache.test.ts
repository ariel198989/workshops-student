import { test } from 'node:test';
import assert from 'node:assert/strict';
import { browserCaches, LEGACY_CACHES, purgeLegacyCaches, type CacheStorageLike } from '../lib/cv/legacy-cache.ts';

function fakeStorage(names: string[]): CacheStorageLike & { names: Set<string>; deletes: string[] } {
  const set = new Set(names);
  const deletes: string[] = [];
  return {
    names: set,
    deletes,
    has: async (n) => set.has(n),
    delete: async (n) => { deletes.push(n); return set.delete(n); },
  };
}

test('the Smart City bucket from before the split is the one being purged, not the workshops cache', () => {
  assert.deepEqual([...LEGACY_CACHES], ['sc-models-v1']);
  assert.ok(!LEGACY_CACHES.includes('ws-models-v1'));
});

test('deletes sc-models-v1 when present and leaves every other bucket', async () => {
  const s = fakeStorage(['sc-models-v1', 'ws-models-v1']);
  assert.deepEqual(await purgeLegacyCaches(s), ['sc-models-v1']);
  assert.deepEqual([...s.names], ['ws-models-v1']);
});

test('does nothing when the bucket is absent, and a second run is a no-op', async () => {
  const s = fakeStorage(['ws-models-v1']);
  assert.deepEqual(await purgeLegacyCaches(s), []);
  assert.deepEqual(s.deletes, []);
  const t = fakeStorage(['sc-models-v1']);
  await purgeLegacyCaches(t);
  assert.deepEqual(await purgeLegacyCaches(t), []);
  assert.deepEqual(t.deletes, ['sc-models-v1']);
});

test('no Cache API, or one that throws, never throws on start', async () => {
  assert.deepEqual(await purgeLegacyCaches(null), []);
  const broken: CacheStorageLike = { has: async () => { throw new Error('SecurityError'); }, delete: async () => true };
  assert.deepEqual(await purgeLegacyCaches(broken), []);
});

test('browserCaches is null where the runtime has no CacheStorage', () => {
  const g = globalThis as { caches?: unknown };
  const had = 'caches' in g;
  const prev = g.caches;
  try {
    g.caches = undefined;
    assert.equal(browserCaches(), null);
    g.caches = { has: async () => false, delete: async () => false };
    assert.ok(browserCaches());
  } finally {
    if (had) g.caches = prev; else delete g.caches;
  }
});
