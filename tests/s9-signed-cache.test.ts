import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  EMPTY_SIGNED, freshUrl, pathsToSign, RENEW_BEFORE_MS, SIGNED_TTL_S, withoutPath, withSigned,
} from '../lib/cv/signed-cache.ts';

const NOW = Date.parse('2026-11-06T09:00:00Z');
const TTL_MS = SIGNED_TTL_S * 1000;
const item = (path: string) => ({ path, signedUrl: `https://x.test/${path}?token=t`, error: null });

test('a signed link is served from the cache until shortly before it expires', () => {
  const cache = withSigned(EMPTY_SIGNED, [item('a.jpg')], NOW);
  assert.equal(freshUrl(cache, 'a.jpg', NOW), 'https://x.test/a.jpg?token=t');
  assert.equal(freshUrl(cache, 'a.jpg', NOW + TTL_MS - RENEW_BEFORE_MS - 1), 'https://x.test/a.jpg?token=t');
  assert.equal(freshUrl(cache, 'a.jpg', NOW + TTL_MS - RENEW_BEFORE_MS), null, 'renewed before the server refuses it');
  assert.equal(freshUrl(cache, 'b.jpg', NOW), null);
});

test('pathsToSign asks only for unique paths without a live link', () => {
  const cache = withSigned(EMPTY_SIGNED, [item('a.jpg')], NOW);
  assert.deepEqual(pathsToSign(cache, ['a.jpg', 'b.jpg', 'b.jpg', 'c.jpg'], NOW), ['b.jpg', 'c.jpg']);
  assert.deepEqual(pathsToSign(cache, ['a.jpg'], NOW + TTL_MS), ['a.jpg'], 'an expired link is signed again');
  assert.deepEqual(pathsToSign(cache, [], NOW), []);
});

test('withSigned skips the paths the server refused and never mutates the old cache', () => {
  const before = withSigned(EMPTY_SIGNED, [item('a.jpg')], NOW);
  const after = withSigned(before, [
    item('b.jpg'),
    { path: 'gone.jpg', signedUrl: null, error: 'Either the object does not exist or you do not have access to it' },
    { path: null, signedUrl: 'https://x.test/?token=t', error: null },
  ], NOW + 1000);
  assert.equal(freshUrl(after, 'b.jpg', NOW + 1000), 'https://x.test/b.jpg?token=t');
  assert.equal(freshUrl(after, 'gone.jpg', NOW + 1000), null);
  assert.equal(after.size, 2);
  assert.equal(before.size, 1, 'the earlier cache is untouched');
  assert.equal(EMPTY_SIGNED.size, 0);
});

test('withSigned drops links that already expired, so the cache holds one hour of work at most', () => {
  const old = withSigned(EMPTY_SIGNED, [item('old.jpg')], NOW);
  const next = withSigned(old, [item('new.jpg')], NOW + TTL_MS);
  assert.deepEqual([...next.keys()], ['new.jpg']);
});

test('withoutPath forgets one link (a photo that failed to load) and keeps the rest', () => {
  const cache = withSigned(EMPTY_SIGNED, [item('a.jpg'), item('b.jpg')], NOW);
  const next = withoutPath(cache, 'a.jpg');
  assert.deepEqual([...next.keys()], ['b.jpg']);
  assert.equal(cache.size, 2);
});
