import { test } from 'node:test';
import assert from 'node:assert/strict';
import { STUDENT_NAV, isStudentNavActive } from '../lib/student/nav.ts';

test('five items in the agreed order with the agreed hrefs', () => {
  assert.deepEqual(
    STUDENT_NAV.map((n) => [n.label, n.href]),
    [
      ['בית', '/student'],
      ['צילום', '/student/capture'],
      ['תיוג', '/student/tag'],
      ['אימון', '/student/train'],
      ['תוצאות', '/student/results'],
    ],
  );
});

test('home is active only on the exact home path', () => {
  assert.equal(isStudentNavActive('/student', '/student'), true);
  assert.equal(isStudentNavActive('/student/tag', '/student'), false);
  assert.equal(isStudentNavActive('/student/join', '/student'), false);
});

test('other items are active on their path and nested paths', () => {
  assert.equal(isStudentNavActive('/student/tag', '/student/tag'), true);
  assert.equal(isStudentNavActive('/student/tag/42', '/student/tag'), true);
  assert.equal(isStudentNavActive('/student/tagging', '/student/tag'), false);
  assert.equal(isStudentNavActive(null, '/student/tag'), false);
});
