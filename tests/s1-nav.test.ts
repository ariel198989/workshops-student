import { test } from 'node:test';
import assert from 'node:assert/strict';
import { STUDENT_NAV, isStudentNavActive } from '../lib/student/nav.ts';

test('five items in the agreed order with the agreed hrefs', () => {
  assert.deepEqual(
    STUDENT_NAV.map((n) => [n.label, n.href]),
    [
      ['בית', '/'],
      ['צילום', '/capture'],
      ['תיוג', '/tag'],
      ['אימון', '/train'],
      ['תוצאות', '/results'],
    ],
  );
});

test('home is active only on the exact home path', () => {
  assert.equal(isStudentNavActive('/', '/'), true);
  assert.equal(isStudentNavActive('/tag', '/'), false);
  assert.equal(isStudentNavActive('/join', '/'), false);
});

test('other items are active on their path and nested paths', () => {
  assert.equal(isStudentNavActive('/tag', '/tag'), true);
  assert.equal(isStudentNavActive('/tag/42', '/tag'), true);
  assert.equal(isStudentNavActive('/tagging', '/tag'), false);
  assert.equal(isStudentNavActive(null, '/tag'), false);
});
