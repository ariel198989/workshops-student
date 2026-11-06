import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openerFor } from '../lib/facilitator/story.ts';

const story = {
  premise_he: 'רובי הגיע לכיתה',
  hero_he: ' רובי, רובוט קטן עם עין אחת ',
  sessions: [
    { session_no: 1, beat_he: 'רובי מגיע', opener_he: 'בוקר טוב! היום מגיע אורח', materials_he: 'כרטיסי עיגול' },
    { session_no: 2, beat_he: 'רובי טועה', opener_he: 'רובי התבלבל' },
    { session_no: 3, beat_he: 'בלי פתיח', opener_he: '  ' },
  ],
};

test('the opener of session N, with beat, materials and the hero line', () => {
  assert.deepEqual(openerFor(story, 1), {
    hero: 'רובי, רובוט קטן עם עין אחת', beat: 'רובי מגיע', opener: 'בוקר טוב! היום מגיע אורח', materials: 'כרטיסי עיגול',
  });
});

test('materials are optional', () => {
  assert.equal(openerFor(story, 2)?.materials, null);
  assert.equal(openerFor(story, 2)?.opener, 'רובי התבלבל');
});

test('hidden when there is no story, no entry for the session, or no opener text', () => {
  assert.equal(openerFor(null, 1), null);
  assert.equal(openerFor({}, 1), null);
  assert.equal(openerFor({ sessions: 'x' }, 1), null);
  assert.equal(openerFor(story, 4), null);
  assert.equal(openerFor(story, 3), null);
  assert.equal(openerFor(story, null), null);
});

test('a session_no sent as text still matches; junk entries are skipped', () => {
  const s = { hero_he: 5, sessions: [null, 'x', { session_no: '2', opener_he: 'שלום' }] };
  assert.deepEqual(openerFor(s, 2), { hero: null, beat: null, opener: 'שלום', materials: null });
});
