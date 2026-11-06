import { test } from 'node:test';
import assert from 'node:assert/strict';
import { excludedNote, packProblem } from '../lib/cv/dataset.ts';

test('photos left out by the face screen are not download failures', () => {
  // 40 of 100 left out for faces: still trains on the other 60
  assert.equal(packProblem({ total: 100, kept: 60, failed: 0, faces: 40, unchecked: 0 }), null);
  // 26 real download failures of 100 abort, as before
  assert.match(packProblem({ total: 100, kept: 74, failed: 26, faces: 0, unchecked: 0 }) ?? '', /26 מתוך 100/);
});

test('nothing kept: a clear reason, faces vs network', () => {
  assert.match(packProblem({ total: 5, kept: 0, failed: 0, faces: 4, unchecked: 1 }) ?? '', /כל התמונות הוצאו/);
  assert.match(packProblem({ total: 5, kept: 0, failed: 5, faces: 0, unchecked: 0 }) ?? '', /לא ירדו/);
});

test('excludedNote counts faces and unchecked photos, singular and plural', () => {
  assert.equal(excludedNote(0, 0), null);
  assert.equal(excludedNote(3, 0), '3 תמונות עם פנים הוצאו מהאימון.');
  assert.equal(excludedNote(1, 0), 'תמונה אחת עם פנים הוצאה מהאימון.');
  assert.equal(excludedNote(2, 1), '2 תמונות עם פנים הוצאו מהאימון. תמונה אחת שלא נבדקה הוצאה.');
});
