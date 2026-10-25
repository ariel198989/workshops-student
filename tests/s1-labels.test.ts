import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  taskTypeLabel, firstName, groupChip, joinErrorMessage, signupErrorMessage,
  pickNextSession, formatSessionWhen, certificateVariantFor, validateSignup, validateJoinName,
} from '../lib/student/labels.ts';

test('task types are Hebrew', () => {
  assert.equal(taskTypeLabel('detect'), 'זיהוי');
  assert.equal(taskTypeLabel('classify'), 'סיווג');
  assert.equal(taskTypeLabel('count'), 'ספירה');
  assert.equal(taskTypeLabel('other'), 'משימה חופשית');
  assert.equal(taskTypeLabel('weird'), 'משימה חופשית');
});

test('firstName takes the first word and tolerates blanks', () => {
  assert.equal(firstName('  דנה כהן '), 'דנה');
  assert.equal(firstName('Noa'), 'Noa');
  assert.equal(firstName(''), '');
  assert.equal(firstName(null), '');
});

test('groupChip joins number and display name with a middle dot', () => {
  assert.equal(groupChip({ number: 3, display_name: 'הנשרים' }), 'קבוצה 3 · הנשרים');
  assert.equal(groupChip({ number: 3, display_name: null }), 'קבוצה 3');
  assert.equal(groupChip({ number: 3, display_name: '  ' }), 'קבוצה 3');
  assert.equal(groupChip(null), '');
});

test('join errors map to Hebrew by code', () => {
  assert.equal(joinErrorMessage({ code: 'P0002' }), 'הקוד לא נמצא או שהסדנה עוד לא נפתחה');
  assert.equal(joinErrorMessage({ code: '23505' }), 'כבר הצטרפת לקבוצה אחרת. בקשו מהמדריך להעביר אתכם');
  assert.match(joinErrorMessage({ code: '22023' }), /שם|קבוצה/);
  assert.match(joinErrorMessage({ code: 'XX000', message: 'boom' }), /נסו שוב/);
  assert.match(joinErrorMessage(null), /נסו שוב/);
});

test('join errors never leak the raw database message', () => {
  assert.doesNotMatch(joinErrorMessage({ code: 'XX000', message: 'relation ws_x does not exist' }), /relation/);
});

test('signup errors are friendly Hebrew', () => {
  assert.match(signupErrorMessage({ message: 'User already registered' }), /כבר רשום/);
  assert.match(signupErrorMessage({ message: 'Password should be at least 6 characters' }), /6/);
  assert.match(signupErrorMessage({ message: 'something else' }), /נסו שוב/);
  assert.doesNotMatch(signupErrorMessage({ message: 'something else' }), /something/);
});

test('validateSignup', () => {
  const ok = { fullName: 'דנה כהן', email: 'dana@example.com', password: 'abcdef' };
  assert.equal(validateSignup(ok), null);
  assert.match(validateSignup({ ...ok, fullName: ' ' }) ?? '', /שם/);
  assert.match(validateSignup({ ...ok, email: 'nope' }) ?? '', /אימייל/);
  assert.match(validateSignup({ ...ok, password: '12345' }) ?? '', /6/);
});

test('validateJoinName needs at least 2 characters', () => {
  assert.equal(validateJoinName('דנה'), null);
  assert.match(validateJoinName(' ד ') ?? '', /שם/);
  assert.match(validateJoinName('') ?? '', /שם/);
});

const sessions = [
  { session_no: 1, title: 'פתיחה', kind: 'regular', scheduled_at: '2026-10-10T10:00:00Z', status: 'done' },
  { session_no: 2, title: 'צילום', kind: 'practical', scheduled_at: '2026-10-20T10:00:00Z', status: 'scheduled' },
  { session_no: 3, title: 'אימון', kind: 'practical', scheduled_at: '2026-10-27T10:00:00Z', status: 'planned' },
  { session_no: 4, title: 'בוטל', kind: 'regular', scheduled_at: '2026-10-19T10:00:00Z', status: 'cancelled' },
];

test('pickNextSession: earliest upcoming that is not done or cancelled', () => {
  const next = pickNextSession(sessions, new Date('2026-10-18T08:00:00Z'));
  assert.equal(next?.session_no, 2);
});

test('pickNextSession: a live session counts even if its start has passed', () => {
  const live = [{ ...sessions[1], status: 'live' }, sessions[2]];
  assert.equal(pickNextSession(live, new Date('2026-10-20T11:00:00Z'))?.session_no, 2);
});

test('pickNextSession: nothing upcoming gives null', () => {
  assert.equal(pickNextSession(sessions, new Date('2026-12-01T00:00:00Z')), null);
  assert.equal(pickNextSession([], new Date()), null);
});

test('pickNextSession: unscheduled sessions are ignored', () => {
  assert.equal(pickNextSession([{ ...sessions[1], scheduled_at: null }], new Date('2026-10-18T08:00:00Z')), null);
});

test('formatSessionWhen renders Israel time, empty for no date', () => {
  const out = formatSessionWhen('2026-10-20T10:00:00Z');
  assert.match(out, /13:00/);
  assert.equal(formatSessionWhen(null), '');
  assert.equal(formatSessionWhen('garbage'), '');
});

test('certificate variant: corporate for custom workshops, standard otherwise', () => {
  assert.equal(certificateVariantFor('custom'), 'corporate');
  assert.equal(certificateVariantFor('sessions'), 'standard');
  assert.equal(certificateVariantFor('hackathon'), 'standard');
});
