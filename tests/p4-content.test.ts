import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseNotes, exerciseSteps, materialLabel, textList } from '../components/ws/p4/notes.ts';
import { defaultGroupCount, parseRoster, hasInactiveGroups } from '../components/ws/p4/groups-utils.ts';

test('parseNotes splits "── title ──" markers into headed sections', () => {
  const text = 'פתיח קצר\n── סדר יום ──\n10 דקות הקדמה\n20 דקות תרגול\n── טיפים ──\nלעצור לשאלות';
  assert.deepEqual(parseNotes(text), [
    { heading: null, lines: ['פתיח קצר'] },
    { heading: 'סדר יום', lines: ['10 דקות הקדמה', '20 דקות תרגול'] },
    { heading: 'טיפים', lines: ['לעצור לשאלות'] },
  ]);
});

test('parseNotes: no markers gives one headless section; blank input gives none', () => {
  assert.deepEqual(parseNotes('שורה א\nשורה ב'), [{ heading: null, lines: ['שורה א', 'שורה ב'] }]);
  assert.deepEqual(parseNotes(''), []);
  assert.deepEqual(parseNotes(null), []);
  assert.deepEqual(parseNotes(undefined), []);
});

test('parseNotes drops empty lines and empty sections, handles CRLF', () => {
  assert.deepEqual(parseNotes('── א ──\r\n\r\nשורה\r\n── ב ──'), [{ heading: 'א', lines: ['שורה'] }]);
});

test('exerciseSteps reads steps[] or a newline-joined instructions string', () => {
  assert.deepEqual(exerciseSteps({ steps: ['א', 'ב'] }), ['א', 'ב']);
  assert.deepEqual(exerciseSteps({ instructions: 'א\n\nב' }), ['א', 'ב']);
  assert.deepEqual(exerciseSteps({ steps: [], instructions: 'ג' }), ['ג']);
  assert.deepEqual(exerciseSteps({}), []);
  assert.deepEqual(exerciseSteps({ steps: [1, 'ב'] }), ['ב']);
});

test('materialLabel accepts strings and {label} objects', () => {
  assert.equal(materialLabel('דף עבודה'), 'דף עבודה');
  assert.equal(materialLabel({ label: 'מצגת', kind: 'handout' }), 'מצגת');
  assert.equal(materialLabel({ title: 'כותרת' }), 'כותרת');
  assert.equal(materialLabel(42), null);
  assert.equal(materialLabel({}), null);
});

test('textList keeps only non-empty strings', () => {
  assert.deepEqual(textList(['א', '', 3, ' ב ', null]), ['א', 'ב']);
  assert.deepEqual(textList('not an array'), []);
});

test('defaultGroupCount = ceil(audience / group size), at least 1, within 1..40', () => {
  assert.equal(defaultGroupCount(32, 4), 8);
  assert.equal(defaultGroupCount(33, 4), 9);
  assert.equal(defaultGroupCount(null, 4), 1);
  assert.equal(defaultGroupCount(0, 4), 1);
  assert.equal(defaultGroupCount(500, 4), 40);
  assert.equal(defaultGroupCount(30, 0), 1);
});

test('parseRoster splits lines, trims, dedupes', () => {
  const r = parseRoster('  דנה כהן \n\nיוסי לוי\nדנה כהן\r\nרות');
  assert.deepEqual(r, ['דנה כהן', 'יוסי לוי', 'רות']);
  assert.deepEqual(parseRoster('   \n  '), []);
});

test('hasInactiveGroups detects groups that still need activation', () => {
  assert.equal(hasInactiveGroups([{ activated: true }, { activated: false }]), true);
  assert.equal(hasInactiveGroups([{ activated: true }]), false);
  assert.equal(hasInactiveGroups([]), false);
});
