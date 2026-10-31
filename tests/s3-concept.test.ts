import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  optionLetter, isScale, questionKey, phasesOf, normalizeQuestions, normalizeChecks, buildAnswers, isComplete,
  lockKey, submitErrorMessage, THANKS, ALREADY_SUBMITTED, ALREADY_SUBMITTED_CODE, type ConceptQuestion,
} from '../lib/student/concept.ts';
import { pointBox, POINT_BOX_FRACTION } from '../lib/cv/geometry.ts';

const knowledge: ConceptQuestion = { id: 'q1', q: 'מה מכונה רואה?', options: ['תמונה', 'טבלה של מספרים', 'מילים'], answer: 1 };
const attitude: ConceptQuestion = { q: 'כמה אני בטוח/ה שאני מבין/ה?', options: [], answer: null };

test('option letters are Hebrew א ב ג', () => {
  assert.deepEqual([0, 1, 2].map(optionLetter), ['א', 'ב', 'ג']);
  assert.equal(optionLetter(8), '9');
});

test('answer null marks an attitude scale; the key is the id or the index', () => {
  assert.equal(isScale(knowledge), false);
  assert.equal(isScale(attitude), true);
  assert.equal(questionKey(knowledge, 3), 'q1');
  assert.equal(questionKey(attitude, 3), '3');
});

test('phasesOf follows phase_available', () => {
  assert.deepEqual(phasesOf({ phase_available: 'both' }), ['pre', 'post']);
  assert.deepEqual(phasesOf({ phase_available: 'pre' }), ['pre']);
  assert.deepEqual(phasesOf({ phase_available: 'post' }), ['post']);
});

test('normalizeQuestions keeps well-formed items only and never invents an id', () => {
  const qs = normalizeQuestions([
    { q: 'a', options: ['x', 'y'], answer: 0, core: 'c' },
    { q: 'scale', answer: null },
    { q: 'bad: one option', options: ['x'], answer: 0 },
    { options: ['x', 'y'], answer: 0 },
    null, 7,
  ]);
  assert.equal(qs.length, 2);
  assert.equal('id' in qs[0], false);
  assert.equal(qs[0].core, 'c');
  assert.deepEqual(qs[1], { q: 'scale', options: [], answer: null });
  assert.deepEqual(normalizeQuestions('x'), []);
});

test('normalizeChecks drops modules without questions and defaults phase to both', () => {
  const checks = normalizeChecks([
    { session_module_id: 'sm1', module_title: 'מבוא', module_slug: 'intro', phase_available: 'both', questions: [knowledge] },
    { session_module_id: 'sm2', module_title: 'ריק', module_slug: 'e', phase_available: 'both', questions: [] },
    { session_module_id: 'sm3', questions: [attitude], phase_available: 'weird' },
  ]);
  assert.deepEqual(checks.map((c) => c.session_module_id), ['sm1', 'sm3']);
  assert.equal(checks[1].phase_available, 'both');
  assert.equal(checks[1].module_title, 'בדיקת מושגים');
  assert.deepEqual(normalizeChecks(undefined), []);
});

test('buildAnswers keys by id or index and skips unanswered items; isComplete needs every pick', () => {
  const qs = [knowledge, attitude];
  assert.deepEqual(buildAnswers(qs, [2, 4]), { q1: 2, '1': 4 });
  assert.deepEqual(buildAnswers(qs, [null, 4]), { '1': 4 });
  assert.equal(isComplete(qs, [2, 4]), true);
  assert.equal(isComplete(qs, [2, null]), false);
  assert.equal(isComplete([], []), false);
});

test('lock key and copy', () => {
  assert.equal(lockKey('sm1', 'pre'), 'ws_check:sm1:pre');
  assert.equal(THANKS, 'תודה, התשובות נשמרו בלי שם');
  assert.match(submitErrorMessage({ code: '42501' }), /משתתפים/);
  assert.equal(submitErrorMessage({ code: '23505', message: 'already submitted' }), ALREADY_SUBMITTED);
  assert.equal(ALREADY_SUBMITTED_CODE, '23505');
  assert.match(submitErrorMessage(null), /השתבש/);
});

test('students get answer -1: still a knowledge question, never a scale, never scored here', () => {
  const [hidden, scale] = normalizeQuestions([
    { id: 'k', q: 'ידע', options: ['א', 'ב', 'ג'], answer: -1 },
    { q: 'עמדה', options: [], answer: null },
  ]);
  assert.equal(hidden.answer, -1);
  assert.equal(isScale(hidden), false, '-1 keeps the options visible');
  assert.equal(isScale(scale), true);
  assert.equal(isScale({ q: 'x', options: ['a', 'b'], answer: undefined as unknown as null }), true, 'a missing answer is a scale');
  // the picks go out unchanged; nothing compares them to answer
  assert.deepEqual(buildAnswers([hidden, scale], [2, 5]), { k: 2, '1': 5 });
  // a hidden-answer question with fewer than two options cannot be shown and is dropped, like any knowledge question
  assert.deepEqual(normalizeQuestions([{ q: 'bad', options: ['one'], answer: -1 }]), []);
});

test('phasesOf hides the phase the workshop does not offer', () => {
  const [pre, post, both] = normalizeChecks([
    { session_module_id: 'a', questions: [knowledge], phase_available: 'pre' },
    { session_module_id: 'b', questions: [knowledge], phase_available: 'post' },
    { session_module_id: 'c', questions: [knowledge], phase_available: 'both' },
  ]);
  assert.deepEqual(phasesOf(pre), ['pre']);
  assert.deepEqual(phasesOf(post), ['post']);
  assert.deepEqual(phasesOf(both), ['pre', 'post']);
});

test('pointBox: 38% of the shorter side, centered, clamped inside the image', () => {
  const size = { width: 400, height: 200 }; // shorter side 200 → 76px square
  const b = pointBox({ x: 0.5, y: 0.5 }, size);
  assert.equal(POINT_BOX_FRACTION, 0.38);
  assert.ok(Math.abs(b.w - 76 / 400) < 1e-9);
  assert.ok(Math.abs(b.h - 76 / 200) < 1e-9);
  assert.ok(Math.abs(b.x + b.w / 2 - 0.5) < 1e-9);
  assert.ok(Math.abs(b.y + b.h / 2 - 0.5) < 1e-9);
  const corner = pointBox({ x: 0, y: 1 }, size);
  assert.equal(corner.x, 0);
  assert.ok(Math.abs(corner.y + corner.h - 1) < 1e-9);
  assert.deepEqual(pointBox({ x: 0.5, y: 0.5 }, { width: 0, height: 0 }), { x: 0, y: 0, w: 0, h: 0 });
});
