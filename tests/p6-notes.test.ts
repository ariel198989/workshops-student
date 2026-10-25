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

let N: typeof import('../components/ws/p6/notes.ts');

before(async () => {
  N = await import('../components/ws/p6/notes.ts');
});

const NOTES = [
  '── סדר יום ──',
  '• 10 ד׳ · פתיחה וחוזה כיתתי — מי אנחנו, מה נבנה.',
  '• 5 ד׳ · הפסקה — מתיחות, מים.',
  '',
  '── הערכה ──',
  'ראיות: הקבוצה רשומה במערכת',
  'הושלם כאשר: כל תלמיד שייך לקבוצה.',
  '',
  '── התאמות ──',
  'קל יותר: רשת 6x6.',
].join('\n');

test('parseNotes splits on the ── X ── markers and keeps order', () => {
  const sections = N.parseNotes(NOTES);
  assert.deepEqual(sections.map((s) => s.title), ['סדר יום', 'הערכה', 'התאמות']);
  assert.equal(sections[0].lines.length, 2);
  assert.equal(sections[1].lines.length, 2);
});

test('parseNotes keeps text before the first marker as an untitled section', () => {
  const sections = N.parseNotes('הערה פתיחה\n── הערכה ──\nראיות: x');
  assert.equal(sections[0].title, null);
  assert.deepEqual(sections[0].lines, ['הערה פתיחה']);
  assert.equal(sections[1].title, 'הערכה');
});

test('parseNotes handles empty, null and marker-less input without throwing', () => {
  assert.deepEqual(N.parseNotes(null), []);
  assert.deepEqual(N.parseNotes('   \n '), []);
  assert.deepEqual(N.parseNotes('שורה אחת\nשורה שתיים'), [{ title: null, lines: ['שורה אחת', 'שורה שתיים'] }]);
});

test('parseNotes drops sections with no body but keeps a marker with lines', () => {
  const sections = N.parseNotes('── ריק ──\n── מלא ──\nשורה');
  assert.deepEqual(sections.map((s) => s.title), ['מלא']);
});

test('parseAgendaLine extracts minutes, title and description', () => {
  const row = N.parseAgendaLine('• 10 ד׳ · פתיחה וחוזה כיתתי — מי אנחנו, מה נבנה.');
  assert.deepEqual(row, { minutes: 10, title: 'פתיחה וחוזה כיתתי', text: 'מי אנחנו, מה נבנה.' });
});

test('parseAgendaLine tolerates a missing description and returns null for plain lines', () => {
  assert.deepEqual(N.parseAgendaLine('• 5 ד׳ · הפסקה'), { minutes: 5, title: 'הפסקה', text: '' });
  assert.equal(N.parseAgendaLine('ראיות: משהו'), null);
});

test('splitLabel splits "label: value" and ignores long prefixes', () => {
  assert.deepEqual(N.splitLabel('הושלם כאשר: כל תלמיד שייך לקבוצה.'), { label: 'הושלם כאשר', value: 'כל תלמיד שייך לקבוצה.' });
  assert.equal(N.splitLabel('משפט ארוך מאוד בלי נקודתיים בכלל'), null);
  assert.equal(N.splitLabel('זה משפט ארוך מאוד מאוד שיש בו נקודתיים אבל רק אחרי הרבה מילים: כן'), null);
});

test('parseAgenda reads the summary "סדר יום" chip list', () => {
  const summary = 'סדר יום: פתיחה וחוזה כיתתי (10 ד׳) · שאלת פתיחה: איך אתם יודעים שזה כוס? (10 ד׳) · הפסקה (5 ד׳)';
  assert.deepEqual(N.parseAgenda(summary), [
    { title: 'פתיחה וחוזה כיתתי', minutes: 10 },
    { title: 'שאלת פתיחה: איך אתם יודעים שזה כוס?', minutes: 10 },
    { title: 'הפסקה', minutes: 5 },
  ]);
});

test('parseAgenda returns [] for free text so the caller can show a paragraph', () => {
  assert.deepEqual(N.parseAgenda('תיאור חופשי של המודול'), []);
  assert.deepEqual(N.parseAgenda(null), []);
});

test('parseAgenda keeps an item with no minutes', () => {
  assert.deepEqual(N.parseAgenda('סדר יום: משהו בלי זמן · עוד (5 ד׳)'), [
    { title: 'משהו בלי זמן', minutes: null },
    { title: 'עוד', minutes: 5 },
  ]);
});

test('instructionSteps strips numbering and blank lines', () => {
  assert.deepEqual(N.instructionSteps('1. מחלקים\n2. אותו שאלון\n\n3) מחשבים'), ['מחלקים', 'אותו שאלון', 'מחשבים']);
  assert.deepEqual(N.instructionSteps(''), []);
  assert.deepEqual(N.instructionSteps('שלב בלי מספר'), ['שלב בלי מספר']);
});
