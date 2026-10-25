import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  nextAttendanceStatus, rowRate, formatRate, nextCell, markKey, ATTENDANCE_CYCLE,
} from '../components/ws/p4/attendance-utils.ts';

test('cycle order is present, late, absent, excused and wraps', () => {
  assert.deepEqual([...ATTENDANCE_CYCLE], ['present', 'late', 'absent', 'excused']);
  assert.equal(nextAttendanceStatus(undefined), 'present');
  assert.equal(nextAttendanceStatus('present'), 'late');
  assert.equal(nextAttendanceStatus('late'), 'absent');
  assert.equal(nextAttendanceStatus('absent'), 'excused');
  assert.equal(nextAttendanceStatus('excused'), 'present');
});

test('markKey joins session and participant', () => {
  assert.equal(markKey('s1', 'p1'), 's1:p1');
});

test('rowRate: present and late count, absent and excused do not', () => {
  const marks = new Map([
    [markKey('s1', 'p'), 'present'], [markKey('s2', 'p'), 'late'],
    [markKey('s3', 'p'), 'absent'], [markKey('s4', 'p'), 'excused'],
  ] as const);
  assert.equal(rowRate(marks, 'p', ['s1', 's2', 's3', 's4']), 0.5);
});

test('rowRate: unmarked cells in a taken session count as missed', () => {
  const marks = new Map([[markKey('s1', 'p'), 'present']] as const);
  assert.equal(rowRate(marks, 'p', ['s1', 's2']), 0.5);
});

test('rowRate: no taken sessions gives null, not 100%', () => {
  assert.equal(rowRate(new Map(), 'p', []), null);
});

test('formatRate renders a whole percent or a dash', () => {
  assert.equal(formatRate(0.8333), '83%');
  assert.equal(formatRate(1), '100%');
  assert.equal(formatRate(null), '-');
});

test('nextCell: RTL arrows, left goes to the next column', () => {
  const dims = { rows: 3, cols: 4 };
  assert.deepEqual(nextCell({ row: 1, col: 1 }, 'ArrowLeft', dims, true), { row: 1, col: 2 });
  assert.deepEqual(nextCell({ row: 1, col: 1 }, 'ArrowRight', dims, true), { row: 1, col: 0 });
  assert.deepEqual(nextCell({ row: 1, col: 1 }, 'ArrowDown', dims, true), { row: 2, col: 1 });
  assert.deepEqual(nextCell({ row: 1, col: 1 }, 'ArrowUp', dims, true), { row: 0, col: 1 });
});

test('nextCell: LTR arrows are the mirror image', () => {
  assert.deepEqual(nextCell({ row: 0, col: 0 }, 'ArrowRight', { rows: 2, cols: 2 }, false), { row: 0, col: 1 });
});

test('nextCell: clamps at the edges and ignores other keys', () => {
  const dims = { rows: 2, cols: 2 };
  assert.deepEqual(nextCell({ row: 0, col: 0 }, 'ArrowUp', dims, true), { row: 0, col: 0 });
  assert.deepEqual(nextCell({ row: 1, col: 1 }, 'ArrowDown', dims, true), { row: 1, col: 1 });
  assert.deepEqual(nextCell({ row: 1, col: 1 }, 'ArrowLeft', dims, true), { row: 1, col: 1 });
  assert.equal(nextCell({ row: 0, col: 0 }, 'a', dims, true), null);
});

test('nextCell: Home and End jump within the row', () => {
  const dims = { rows: 2, cols: 5 };
  assert.deepEqual(nextCell({ row: 1, col: 2 }, 'Home', dims, true), { row: 1, col: 0 });
  assert.deepEqual(nextCell({ row: 1, col: 2 }, 'End', dims, true), { row: 1, col: 4 });
});
