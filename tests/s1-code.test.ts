import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeCode, isCodeComplete } from '../lib/student/code.ts';

test('uppercases and trims', () => {
  assert.equal(normalizeCode('  ofek-h2-27 '), 'OFEK-H2-27');
});

test('removes inner spaces', () => {
  assert.equal(normalizeCode('ofek h2 27'), 'OFEKH227');
  assert.equal(normalizeCode('OFEK - H2 - 27'), 'OFEK-H2-27');
});

test('unifies unicode dashes to a hyphen', () => {
  assert.equal(normalizeCode('OFEK–H2—27'), 'OFEK-H2-27');
  assert.equal(normalizeCode('OFEK‑H2−27'), 'OFEK-H2-27');
});

test('drops characters that cannot be in a code', () => {
  assert.equal(normalizeCode('OFEK-H2-27!?'), 'OFEK-H2-27');
  assert.equal(normalizeCode('קוד OFEK-H2-27'), 'OFEK-H2-27');
});

test('collapses repeated hyphens and strips edge hyphens', () => {
  assert.equal(normalizeCode('--OFEK---H2--'), 'OFEK-H2');
});

test('empty and nullish input give an empty string', () => {
  assert.equal(normalizeCode(''), '');
  assert.equal(normalizeCode(null), '');
  assert.equal(normalizeCode(undefined), '');
});

test('isCodeComplete needs at least 4 characters of letters or digits', () => {
  assert.equal(isCodeComplete('OFEK-H2-27'), true);
  assert.equal(isCodeComplete('AB'), false);
  assert.equal(isCodeComplete('A-B'), false);
  assert.equal(isCodeComplete(''), false);
});
