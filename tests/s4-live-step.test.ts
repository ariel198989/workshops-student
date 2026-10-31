import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  BREAK_KEY, BREAK_LABEL, breakArgs, isOnAir, liveLabelOf, liveStepArgs, LIVE_STEP_KEYS, MAX_LABEL, routesFor, stepKeyFor,
} from '../lib/facilitator/live-step.ts';

test('LIVE_STEP_KEYS mirrors the server allow-list', () => {
  assert.deepEqual([...LIVE_STEP_KEYS], ['capture', 'tag', 'train', 'results', 'check', 'certificate']);
});

test('stepKeyFor: agenda text → student screen', () => {
  assert.equal(stepKeyFor('הקבוצות מצלמות את האובייקטים'), 'capture');
  assert.equal(stepKeyFor('מתייגים 20 תמונות כל אחד'), 'tag');
  assert.equal(stepKeyFor('מסמנים תיבות'), 'tag');
  assert.equal(stepKeyFor('שולחים לאימון'), 'train');
  assert.equal(stepKeyFor('אימון בענן'), 'train');
  assert.equal(stepKeyFor('מסתכלים על התוצאות'), 'results');
  assert.equal(stepKeyFor('ציון המודל'), 'results');
  assert.equal(stepKeyFor('שאלון פתיחה'), 'check');
  assert.equal(stepKeyFor('בדיקת מושגים'), 'check');
  assert.equal(stepKeyFor('מחלקים תעודות'), 'certificate');
});

test('stepKeyFor: talk, demo and discussion have no screen; the first rule wins on mixed lines', () => {
  assert.equal(stepKeyFor('הלקוח מציג את הבעיה'), null);
  assert.equal(stepKeyFor('דיון: מה המודל טעה'), null);
  assert.equal(stepKeyFor(''), null);
  assert.equal(stepKeyFor(null), null);
  assert.equal(stepKeyFor('מצלמים ומתייגים'), 'capture');
});

test('routesFor: the step itself, nothing for null', () => {
  assert.deepEqual(routesFor('tag'), ['tag']);
  assert.deepEqual(routesFor(null), []);
});

test('liveStepArgs: key from the text, the line as the label, empty routes when there is no screen', () => {
  assert.deepEqual(liveStepArgs('w1', 'm1', 'מתייגים בזוגות'), {
    p_workshop: 'w1', p_session_module: 'm1', p_step_key: 'tag', p_label: 'מתייגים בזוגות', p_allowed_routes: ['tag'], p_message: null,
  });
  const talk = liveStepArgs('w1', null, '  הלקוח מציג  ', 'בשקט');
  assert.equal(talk.p_step_key, null);
  assert.deepEqual(talk.p_allowed_routes, []);
  assert.equal(talk.p_label, 'הלקוח מציג');
  assert.equal(talk.p_message, 'בשקט');
  assert.equal(liveStepArgs('w1', null, '   ').p_label, null);
});

test('liveStepArgs keeps the label inside the server limit', () => {
  const long = 'מ'.repeat(MAX_LABEL + 40);
  const label = liveStepArgs('w1', null, long).p_label ?? '';
  assert.ok(label.length <= MAX_LABEL);
  assert.ok(label.endsWith('…'));
});

test('breakArgs: the break has a label and no screens', () => {
  assert.deepEqual(breakArgs('w1'), {
    p_workshop: 'w1', p_session_module: null, p_step_key: BREAK_KEY, p_label: BREAK_LABEL, p_allowed_routes: [], p_message: null,
  });
  assert.equal(BREAK_LABEL, 'הפסקה');
});

test('liveLabelOf and isOnAir', () => {
  assert.equal(liveLabelOf(null), null);
  assert.equal(liveLabelOf({ label: 'מצלמים', step_key: 'capture' }), 'מצלמים');
  assert.equal(liveLabelOf({ label: ' ', step_key: 'capture' }), 'capture');
  assert.equal(liveLabelOf({ label: null, step_key: null }), null);
  assert.equal(isOnAir('מצלמים', ' מצלמים '), true);
  assert.equal(isOnAir('מצלמים', 'מתייגים'), false);
  assert.equal(isOnAir(null, 'מצלמים'), false);
});
