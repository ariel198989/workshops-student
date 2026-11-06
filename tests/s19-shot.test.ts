import { test } from 'node:test';
import assert from 'node:assert/strict';
import { takeShot, type ShotSteps } from '../lib/cv/shot.ts';
import type { GuardStatus, GuardVerdict } from '../lib/cv/face-guard.ts';

interface Item { verdict: string }

/** A capture shot with a mocked checkFrame; records what reached the upload queue. */
function steps(status: GuardStatus, check: () => Promise<GuardVerdict>, room = true) {
  const queued: Item[] = [];
  let grabbed = 0;
  const s: ShotSteps<Item> = {
    guardStatus: () => status,
    grab: async () => { grabbed += 1; return new Blob(['jpeg']); },
    check,
    makeItem: (_blob, verdict) => ({ verdict }),
    submit: (item) => { if (room) queued.push(item); return room; },
  };
  return { s, queued, grabbed: () => grabbed };
}

test('a face: nothing uploads', async () => {
  const t = steps('ready', async () => 'face');
  assert.equal((await takeShot(t.s)).outcome, 'face');
  assert.deepEqual(t.queued, []);
});

test('the check threw (or answered error): nothing uploads, the student shoots again', async () => {
  const threw = steps('ready', async () => { throw new Error('estimateFaces failed'); });
  assert.equal((await takeShot(threw.s)).outcome, 'retry');
  assert.deepEqual(threw.queued, []);
  const error = steps('ready', async () => 'error');
  assert.equal((await takeShot(error.s)).outcome, 'retry');
  assert.deepEqual(error.queued, []);
});

test('guard not ready: nothing is taken or uploaded', async () => {
  for (const status of ['idle', 'loading'] as const) {
    const t = steps(status, async () => 'clear');
    assert.equal((await takeShot(t.s)).outcome, 'not-ready');
    assert.equal(t.grabbed(), 0);
    assert.deepEqual(t.queued, []);
  }
  // ready at the button, but the guard answers not-ready (a race): still no upload
  const race = steps('ready', async () => 'not-ready');
  assert.equal((await takeShot(race.s)).outcome, 'not-ready');
  assert.deepEqual(race.queued, []);
});

test('clear: the photo is queued, marked as checked', async () => {
  const t = steps('ready', async () => 'clear');
  assert.equal((await takeShot(t.s)).outcome, 'queued');
  assert.deepEqual(t.queued, [{ verdict: 'clear' }]);
});

test('hard detector failure: upload is allowed, marked skipped (the screen shows the banner)', async () => {
  const t = steps('failed', async () => 'skipped');
  assert.equal((await takeShot(t.s)).outcome, 'queued');
  assert.deepEqual(t.queued, [{ verdict: 'skipped' }]);
});

test('a full queue is reported, and no frame means no shot', async () => {
  const full = steps('ready', async () => 'clear', false);
  assert.equal((await takeShot(full.s)).outcome, 'queue-full');
  const empty = steps('ready', async () => 'clear');
  empty.s.grab = async () => null;
  assert.equal((await takeShot(empty.s)).outcome, 'no-frame');
  assert.deepEqual(empty.queued, []);
});
