import { test } from 'node:test';
import assert from 'node:assert/strict';
import { encodeMemberDrag, parseMemberDrag, reorderIds, applyMove } from '../components/ws/p4/drag.ts';

test('member drag payload round-trips', () => {
  const raw = encodeMemberDrag({ participantId: 'p1', fromGroupId: 'g1' });
  assert.deepEqual(parseMemberDrag(raw), { participantId: 'p1', fromGroupId: 'g1' });
});

test('member drag payload keeps a null source group (unassigned tray)', () => {
  const raw = encodeMemberDrag({ participantId: 'p1', fromGroupId: null });
  assert.deepEqual(parseMemberDrag(raw), { participantId: 'p1', fromGroupId: null });
});

test('parseMemberDrag rejects garbage', () => {
  for (const bad of ['', 'nope', '{}', '[]', 'null', '{"participantId":5}', '{"participantId":""}',
    '{"participantId":"p","fromGroupId":7}']) {
    assert.equal(parseMemberDrag(bad), null, bad);
  }
});

test('parseMemberDrag treats a missing fromGroupId as null', () => {
  assert.deepEqual(parseMemberDrag('{"participantId":"p1"}'), { participantId: 'p1', fromGroupId: null });
});

test('reorderIds moves the dragged id to the target slot', () => {
  assert.deepEqual(reorderIds(['a', 'b', 'c', 'd'], 'a', 'c'), ['b', 'c', 'a', 'd']);
  assert.deepEqual(reorderIds(['a', 'b', 'c', 'd'], 'd', 'b'), ['a', 'd', 'b', 'c']);
});

test('reorderIds is a no-op for same id or unknown ids and never mutates', () => {
  const input = Object.freeze(['a', 'b', 'c']);
  assert.deepEqual(reorderIds(input, 'b', 'b'), ['a', 'b', 'c']);
  assert.deepEqual(reorderIds(input, 'x', 'b'), ['a', 'b', 'c']);
  assert.deepEqual(reorderIds(input, 'a', 'x'), ['a', 'b', 'c']);
});

test('reorderIds keeps the complete set (reorder RPC needs every id)', () => {
  const out = reorderIds(['a', 'b', 'c', 'd', 'e'], 'e', 'a');
  assert.deepEqual([...out].sort(), ['a', 'b', 'c', 'd', 'e']);
});

test('applyMove changes only the moved participant and returns a new array', () => {
  const rows = [{ id: 'p1', group_id: 'g1' }, { id: 'p2', group_id: 'g1' }] as const;
  const out = applyMove(rows, 'p1', 'g2');
  assert.deepEqual(out, [{ id: 'p1', group_id: 'g2' }, { id: 'p2', group_id: 'g1' }]);
  assert.notEqual(out, rows);
  assert.equal(rows[0].group_id, 'g1');
  assert.equal(out[1], rows[1]);
});

test('applyMove can unassign', () => {
  assert.equal(applyMove([{ id: 'p1', group_id: 'g1' }], 'p1', null)[0].group_id, null);
});
