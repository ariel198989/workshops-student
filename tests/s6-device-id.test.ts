import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEVICE_ID_KEY, DEVICE_ID_LENGTH, getOrCreateDeviceId, isDeviceId, newDeviceId, type RandomBytes,
} from '../lib/student/device-id.ts';
import type { StorageLike } from '../lib/student/pending.ts';

function fakeStorage(initial: Record<string, string> = {}): StorageLike & { data: Map<string, string> } {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => { data.set(k, v); },
    removeItem: (k) => { data.delete(k); },
  };
}

function throwingStorage(): StorageLike {
  const boom = () => { throw new Error('blocked'); };
  return { getItem: boom, setItem: boom, removeItem: boom };
}

/** Deterministic bytes: 0, 1, 2, ... so the id is the alphabet in order. */
const counting: RandomBytes = (n) => Uint8Array.from({ length: n }, (_, i) => i);
const constant = (b: number): RandomBytes => (n) => new Uint8Array(n).fill(b);

const ID_RE = /^[A-Za-z0-9_-]{32}$/;

test('constants: 32 chars under ws.deviceId', () => {
  assert.equal(DEVICE_ID_KEY, 'ws.deviceId');
  assert.equal(DEVICE_ID_LENGTH, 32);
});

test('newDeviceId: 32 chars of [A-Za-z0-9_-], one byte per char, 6 bits used', () => {
  const id = newDeviceId(counting);
  assert.match(id, ID_RE);
  assert.equal(id, 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdef', 'bytes 0..31 map onto the alphabet in order');
  assert.equal(newDeviceId(constant(63)), '-'.repeat(32), 'the 64th symbol is a hyphen');
  assert.equal(newDeviceId(constant(64)), 'A'.repeat(32), 'bits above the 6th are masked off, never out of range');
  assert.equal(newDeviceId(constant(255)), '-'.repeat(32));
});

test('newDeviceId with the real crypto source is well-formed and different each time', () => {
  const a = newDeviceId();
  const b = newDeviceId();
  assert.match(a, ID_RE);
  assert.match(b, ID_RE);
  assert.notEqual(a, b);
  assert.equal(isDeviceId(a), true);
});

test('isDeviceId: 16 to 64 of the allowed alphabet, nothing else', () => {
  assert.equal(isDeviceId('A'.repeat(16)), true);
  assert.equal(isDeviceId('a-_9'.repeat(16)), true, '64 chars');
  assert.equal(isDeviceId('A'.repeat(15)), false);
  assert.equal(isDeviceId('A'.repeat(65)), false);
  assert.equal(isDeviceId('A'.repeat(20) + '!'), false);
  assert.equal(isDeviceId('A'.repeat(20) + ' '), false);
  assert.equal(isDeviceId(''), false);
  assert.equal(isDeviceId(null), false);
  assert.equal(isDeviceId(undefined), false);
});

test('getOrCreateDeviceId mints once and then returns the stored id', () => {
  const st = fakeStorage();
  const first = getOrCreateDeviceId(st, counting);
  assert.match(first, ID_RE);
  assert.equal(st.data.get(DEVICE_ID_KEY), first);
  let called = 0;
  const second = getOrCreateDeviceId(st, (n) => { called++; return counting(n); });
  assert.equal(second, first, 'the same phone keeps its identity');
  assert.equal(called, 0, 'no new randomness while a good id is stored');
});

test('getOrCreateDeviceId replaces a stored id that is not well-formed', () => {
  for (const junk of ['', 'short', 'has space in it and is long enough', 'x'.repeat(65), 'ok-but-has-$-sign-123456']) {
    const st = fakeStorage({ [DEVICE_ID_KEY]: junk });
    const id = getOrCreateDeviceId(st, counting);
    assert.match(id, ID_RE);
    assert.notEqual(id, junk);
    assert.equal(st.data.get(DEVICE_ID_KEY), id, `junk ${JSON.stringify(junk)} is overwritten`);
  }
});

test('getOrCreateDeviceId keeps a stored id of any accepted length', () => {
  const sixteen = 'Q'.repeat(16);
  assert.equal(getOrCreateDeviceId(fakeStorage({ [DEVICE_ID_KEY]: sixteen }), counting), sixteen);
});

test('getOrCreateDeviceId survives a missing or blocked storage', () => {
  assert.match(getOrCreateDeviceId(null, counting), ID_RE, 'no storage: the sign-in still gets an id');
  assert.match(getOrCreateDeviceId(throwingStorage(), counting), ID_RE, 'blocked storage: same');
  assert.doesNotThrow(() => getOrCreateDeviceId(throwingStorage()));
});
