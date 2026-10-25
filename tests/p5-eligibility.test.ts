import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';

const HOOK = `export async function resolve(spec, ctx, next) {
  try { return await next(spec, ctx); }
  catch (e) {
    if (e && e.code === 'ERR_MODULE_NOT_FOUND' && /^\\.\\.?\\//.test(spec)) return next(spec + '.ts', ctx);
    throw e;
  }
}`;
register('data:text/javascript,' + encodeURIComponent(HOOK), import.meta.url);

let E: typeof import('../components/ws/p5/eligibility.ts');
before(async () => {
  E = await import('../components/ws/p5/eligibility.ts');
});

const sessions = [
  { id: 's1', attendance_taken: true }, { id: 's2', attendance_taken: true },
  { id: 's3', attendance_taken: true }, { id: 's4', attendance_taken: false },
];
const participants = [
  { id: 'p1', full_name: 'א', group_id: 'g1', status: 'active' as const },
  { id: 'p2', full_name: 'ב', group_id: 'g1', status: 'active' as const },
  { id: 'p3', full_name: 'ג', group_id: null, status: 'active' as const },
  { id: 'p4', full_name: 'ד', group_id: 'g1', status: 'withdrawn' as const },
];
const mark = (s: string, p: string, status: 'present' | 'late' | 'absent') =>
  ({ session_id: s, participant_id: p, status });
const attendance = [
  mark('s1', 'p1', 'present'), mark('s2', 'p1', 'late'), mark('s3', 'p1', 'present'),
  mark('s1', 'p2', 'present'), mark('s2', 'p2', 'absent'), mark('s3', 'p2', 'absent'),
];
const base = {
  participants, sessions, attendance, deliverables: [{ group_id: 'g1', status: 'submitted' as const }],
  certifiedParticipantIds: new Set<string>(), minAttendance: 0.5, requireDeliverable: false,
};

test('only active participants are listed; attendance counts present and late on taken sessions', () => {
  const rows = E.computeEligibility(base);
  assert.deepEqual(rows.map((r) => r.participantId), ['p1', 'p2', 'p3']);
  assert.equal(rows[0].attendance, 1);
  assert.equal(Math.round(rows[1].attendance * 100), 33);
  assert.equal(rows[2].attendance, 0);
});

test('attendance below the minimum is skipped with reason attendance', () => {
  const rows = E.computeEligibility(base);
  assert.equal(rows[0].reason, null);
  assert.equal(rows[1].reason, 'attendance');
  assert.equal(rows[2].reason, 'attendance');
});

test('exactly at the minimum is eligible', () => {
  const rows = E.computeEligibility({ ...base, minAttendance: 1 / 3 });
  assert.equal(rows[1].reason, null);
});

test('no taken sessions means everyone has full attendance', () => {
  const rows = E.computeEligibility({ ...base, sessions: [{ id: 's4', attendance_taken: false }] });
  assert.ok(rows.every((r) => r.attendance === 1));
});

test('requireDeliverable skips participants without a submitted or approved deliverable', () => {
  const rows = E.computeEligibility({ ...base, minAttendance: 0, requireDeliverable: true });
  assert.equal(rows[0].reason, null);
  assert.equal(rows[2].reason, 'deliverable');
  const inProgress = E.computeEligibility({
    ...base, minAttendance: 0, requireDeliverable: true, deliverables: [{ group_id: 'g1', status: 'in_progress' }],
  });
  assert.equal(inProgress[0].reason, 'deliverable');
});

test('already issued wins over every other reason', () => {
  const rows = E.computeEligibility({ ...base, certifiedParticipantIds: new Set(['p2']) });
  assert.equal(rows[1].reason, 'already_issued');
});

test('summarize counts eligible rows', () => {
  const rows = E.computeEligibility(base);
  assert.deepEqual(E.summarize(rows), { eligible: 1, skipped: 2, total: 3 });
});

test('skip reasons have Hebrew labels', () => {
  for (const r of ['already_issued', 'attendance', 'deliverable'] as const) {
    assert.ok(E.SKIP_REASON_LABELS[r].length > 0);
  }
});

test('canIssueInStatus: only live and completed', () => {
  assert.equal(E.canIssueInStatus('live'), true);
  assert.equal(E.canIssueInStatus('completed'), true);
  assert.equal(E.canIssueInStatus('confirmed'), false);
});
