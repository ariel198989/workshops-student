import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  agendaTotal, fmtClock, fmtShortDate, he, KIND_HE, parseAgendaLine, parseNotes, parseSteps, pickDefaultSession,
  safeContent, sessionChipLabel, sessionTotal, STAGE_HE, TYPE_HE, type SessionRow,
} from '../lib/facilitator/guide.ts';

const NOTES = `המטרה במפגש הראשון היא סקרנות, לא הרצאה.
שורה שנייה של הערות.

── סדר יום ──
• 10 ד׳ · פתיחה וחוזה כיתתי — מי אנחנו, מה נבנה בשישה מפגשים.
• 8 ד׳ · הלקוח מציג - text with hyphen
• 5 ד׳ · הפסקה
• כותרת בלי דקות — טקסט

── הערכה ──
ראיות: הקבוצה רשומה במערכת
הושלם כאשר: כל תלמיד שייך לקבוצה.

── התאמות ──
קל יותר: רשת 6x6 עם 3 גוונים.
מאתגר יותר: שני חפצים דומים.`;

test('parseNotes splits the free text from the three delimited sections', () => {
  const p = parseNotes(NOTES);
  assert.equal(p.notes, 'המטרה במפגש הראשון היא סקרנות, לא הרצאה.\nשורה שנייה של הערות.');
  assert.equal(p.agenda.length, 4);
  assert.deepEqual(p.agenda[0], { minutes: 10, title: 'פתיחה וחוזה כיתתי', text: 'מי אנחנו, מה נבנה בשישה מפגשים.' });
  assert.deepEqual(p.agenda[1], { minutes: 8, title: 'הלקוח מציג', text: 'text with hyphen' });
  assert.deepEqual(p.agenda[2], { minutes: 5, title: 'הפסקה', text: '' }, 'no separator: the whole line is the title');
  assert.deepEqual(p.agenda[3], { minutes: null, title: 'כותרת בלי דקות', text: 'טקסט' });
  assert.match(p.assessment, /^ראיות: הקבוצה רשומה במערכת\nהושלם כאשר:/);
  assert.equal(p.adaptations.easier, 'רשת 6x6 עם 3 גוונים.');
  assert.equal(p.adaptations.harder, 'שני חפצים דומים.');
  assert.equal(agendaTotal(p.agenda), 23);
});

test('parseNotes copes with missing, empty and section-less notes', () => {
  assert.deepEqual(parseNotes(null), { notes: '', agenda: [], assessment: '', adaptations: { easier: '', harder: '', raw: '' } });
  assert.deepEqual(parseNotes('').agenda, []);
  const p = parseNotes('רק הערות חופשיות\nבלי חלקים');
  assert.equal(p.notes, 'רק הערות חופשיות\nבלי חלקים');
  assert.deepEqual(p.agenda, []);
  // a section with an unknown title is ignored, not merged into the notes
  const q = parseNotes('הערה\n── משהו אחר ──\nשורה\n── סדר יום ──\n• 3 ד׳ · א — ב');
  assert.equal(q.notes, 'הערה');
  assert.equal(q.agenda.length, 1);
  // Windows line endings and ascii dashes in the delimiter
  const r = parseNotes('x\r\n-- סדר יום --\r\n• 2 ד׳ · א — ב\r\n');
  assert.equal(r.agenda[0].minutes, 2);
});

test('parseAgendaLine handles stray formats', () => {
  assert.equal(parseAgendaLine(''), null);
  assert.equal(parseAgendaLine('   '), null);
  assert.deepEqual(parseAgendaLine("- 12 דק' · כותרת – טקסט"), { minutes: 12, title: 'כותרת', text: 'טקסט' });
  assert.deepEqual(parseAgendaLine('15 min · intro — hi'), { minutes: 15, title: 'intro', text: 'hi' });
  assert.deepEqual(parseAgendaLine('רק כותרת'), { minutes: null, title: 'רק כותרת', text: '' });
  // a hyphen inside a word (10x10, detect-classify) is not a separator
  assert.deepEqual(parseAgendaLine('• 5 ד׳ · רשת 10x10 ו-detect — ציור'), { minutes: 5, title: 'רשת 10x10 ו-detect', text: 'ציור' });
});

test('parseSteps splits numbered lines and keeps unnumbered ones', () => {
  assert.deepEqual(parseSteps('1. מחלקים דפים.\n2. בזוגות: צובעים.\n3. משווים.'), ['מחלקים דפים.', 'בזוגות: צובעים.', 'משווים.']);
  assert.deepEqual(parseSteps('1) א\n- ב\n\nג\n'), ['א', 'ב', 'ג']);
  assert.deepEqual(parseSteps(''), []);
  assert.deepEqual(parseSteps(null), []);
});

const S = (n: number, scheduled_at: string | null, status = 'scheduled'): SessionRow => ({
  id: `s${n}`, workshop_id: 'w', session_no: n, title: `מפגש ${n}`, kind: 'regular', scheduled_at, duration_minutes: 120, status,
});

test('pickDefaultSession prefers today, then the earliest upcoming open session', () => {
  const now = new Date(2026, 10, 1, 9, 0); // 1 Nov 2026 local
  const sessions = [S(1, '2026-10-25T15:00:00+00:00', 'done'), S(2, '2026-11-01T15:00:00+00:00'), S(3, '2026-11-08T15:00:00+00:00')];
  assert.equal(pickDefaultSession(sessions, now)?.id, 's2', 'today wins even if its time is later');
  const later = new Date(2026, 10, 3);
  assert.equal(pickDefaultSession(sessions, later)?.id, 's3');
  // the earliest upcoming, not the first in list order
  const shuffled = [S(1, '2026-12-01T10:00:00+00:00'), S(2, '2026-11-20T10:00:00+00:00')];
  assert.equal(pickDefaultSession(shuffled, later)?.id, 's2');
});

test('pickDefaultSession falls back to the first open session, then the first', () => {
  const past = new Date(2027, 0, 1);
  const sessions = [S(1, '2026-10-25T15:00:00+00:00', 'completed'), S(2, '2026-11-01T15:00:00+00:00'), S(3, null)];
  assert.equal(pickDefaultSession(sessions, past)?.id, 's2', 'all past: the first that is not finished');
  const allDone = [S(1, '2026-10-25T15:00:00+00:00', 'done'), S(2, null, 'cancelled')];
  assert.equal(pickDefaultSession(allDone, past)?.id, 's1');
  assert.equal(pickDefaultSession([], past), null);
  const unscheduled = [S(1, null), S(2, 'not a date')];
  assert.equal(pickDefaultSession(unscheduled, past)?.id, 's1');
});

test('totals, labels and maps', () => {
  assert.equal(sessionTotal([{ duration_minutes: 20 }, { duration_minutes: null }, { duration_minutes: 25 }]), 45);
  assert.equal(sessionChipLabel(S(1, null), 45), 'מפגש 1 · מפגש 1 · 45 ד׳');
  assert.equal(sessionChipLabel({ ...S(2, null), title: null, duration_minutes: null }, 0), 'מפגש 2');
  assert.equal(sessionChipLabel({ ...S(3, null), title: 'אני המודל' }, 0), 'מפגש 3 · אני המודל · 120 ד׳', 'falls back to the session duration');
  assert.equal(he(STAGE_HE, 'collect'), 'איסוף דאטה');
  assert.equal(he(TYPE_HE, 'practice'), 'תרגול');
  assert.equal(he(KIND_HE, 'group'), 'בקבוצות');
  assert.equal(he(KIND_HE, 'weird'), 'weird', 'unknown keys pass through');
  assert.equal(he(KIND_HE, null), null);
  assert.equal(fmtClock(0), '00:00');
  assert.equal(fmtClock(-4), '00:00');
  assert.equal(fmtClock(605), '10:05');
  assert.equal(fmtShortDate(null), '');
  assert.equal(fmtShortDate('garbage'), '');
  assert.match(fmtShortDate('2026-11-01T15:00:00+00:00'), /\d/);
});

test('safeContent tolerates missing and malformed jsonb', () => {
  const empty = safeContent(null);
  assert.deepEqual(empty.objectives, []);
  assert.deepEqual(empty.exercises, []);
  assert.equal(empty.summary, '');
  const c = safeContent({
    summary: 7, objectives: ['א', 3, 'ב'],
    exercises: [null, { title: 'x', instructions: '1. a', kind: 'group', tool_hook: 'none', questions: [{ q: 'q?', options: ['1', '2'], answer: '2', core: true }, { nope: 1 }] }],
    materials: [{ label: 'דפים', kind: 'supply' }, { kind: 'x' }],
  });
  assert.equal(c.summary, '');
  assert.deepEqual(c.objectives, ['א', 'ב']);
  assert.equal(c.exercises.length, 1);
  assert.deepEqual(c.exercises[0].questions, [{ q: 'q?', options: ['1', '2'], answer: '2', core: true }]);
  assert.deepEqual(c.materials, [{ label: 'דפים', kind: 'supply' }]);
});
