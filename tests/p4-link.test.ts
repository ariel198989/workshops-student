import { test } from 'node:test';
import assert from 'node:assert/strict';
import { linkCandidates, linkArgs } from '../components/ws/p4/link-utils.ts';

type Row = Parameters<typeof linkCandidates>[1][number];
const row = (over: Partial<Row> & { id: string }): Row => ({
  user_id: null, source: 'roster', status: 'active', full_name: over.id, ...over,
});

const roster = row({ id: 'r1' });
const signup = row({ id: 's1', source: 'signup', user_id: 'u1' });

test('a roster row without an account offers signup rows that have an account', () => {
  const rows = [roster, signup, row({ id: 'r2' }), row({ id: 's2', source: 'signup', user_id: 'u2', status: 'withdrawn' })];
  assert.deepEqual(linkCandidates(roster, rows).map((r) => r.id), ['s1']);
});

test('a signup row offers roster rows that still lack an account', () => {
  const rows = [roster, signup, row({ id: 'r2' }), row({ id: 'r3', user_id: 'u9' })];
  assert.deepEqual(linkCandidates(signup, rows).map((r) => r.id), ['r1', 'r2']);
});

test('a linked roster row has nothing to link', () => {
  const linked = row({ id: 'r9', user_id: 'u9' });
  assert.deepEqual(linkCandidates(linked, [linked, signup, roster]), []);
});

test('linkArgs always links the roster row to the signup account', () => {
  assert.deepEqual(linkArgs(roster, signup), { participantId: 'r1', userId: 'u1' });
  assert.deepEqual(linkArgs(signup, roster), { participantId: 'r1', userId: 'u1' });
});

test('linkArgs returns null for an impossible pair', () => {
  assert.equal(linkArgs(roster, row({ id: 'r2' })), null);
  assert.equal(linkArgs(signup, row({ id: 's2', source: 'signup', user_id: 'u2' })), null);
});
