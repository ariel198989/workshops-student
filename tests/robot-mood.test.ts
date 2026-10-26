import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  joinHe, lightTone, lineFor, moodFromPrediction, moodOnEvent, shouldSpeak, SPEAK_GAP_MS,
} from '../lib/robot/mood.ts';

test('mood follows the confidence thresholds, frozen means thinking', () => {
  assert.equal(moodFromPrediction(null, false), 'lost');
  assert.equal(moodFromPrediction({ confidence: 0.95 }, false), 'sure');
  assert.equal(moodFromPrediction({ confidence: 0.8 }, false), 'sure');
  assert.equal(moodFromPrediction({ confidence: 0.79 }, false), 'unsure');
  assert.equal(moodFromPrediction({ confidence: 0.5 }, false), 'unsure');
  assert.equal(moodFromPrediction({ confidence: 0.49 }, false), 'lost');
  assert.equal(moodFromPrediction({ confidence: 0.95 }, true), 'thinking');
  assert.equal(moodFromPrediction(null, true), 'thinking');
});

test('events map to faces', () => {
  assert.equal(moodOnEvent('shot'), 'curious');
  assert.equal(moodOnEvent('learned'), 'happy');
  assert.equal(moodOnEvent('right'), 'happy');
  assert.equal(moodOnEvent('wrong'), 'oops');
  assert.equal(moodOnEvent('reset'), 'sleep');
  assert.equal(moodOnEvent('class_added'), 'curious');
});

test('canonical lines (seed 0) are the ones the classroom script expects', () => {
  assert.equal(lineFor('shot'), 'עוד אחת! אני אוסף דוגמאות');
  assert.equal(lineFor('learned', { count: 12, className: 'כוס' }), 'יש! למדתי 12 תמונות של כוס');
  assert.equal(lineFor('sure', { className: 'נעל' }), 'זה נעל, אני בטוח');
  assert.equal(lineFor('unsure', { className: 'נעל' }), 'אני חושב ש… נעל? לא בטוח');
  assert.equal(lineFor('lost'), 'את זה עוד לא לימדתם אותי');
  assert.equal(lineFor('right'), 'צדקתי!');
  assert.equal(lineFor('wrong'), 'טעיתי. תראו לי עוד דוגמאות?');
  assert.equal(lineFor('reset'), 'שכחתי הכול. מתחילים מחדש');
});

test('lines are deterministic by seed, cycle through the pool and never show a percentage', () => {
  assert.equal(lineFor('happy', {}, 1), lineFor('happy', {}, 1));
  assert.notEqual(lineFor('happy', {}, 0), lineFor('happy', {}, 1));
  assert.equal(lineFor('happy', {}, 3), lineFor('happy', {}, 0), 'wraps around');
  assert.equal(lineFor('happy', {}, -1), lineFor('happy', {}, 2), 'negative seeds are safe');
  const keys = ['sleep', 'idle', 'curious', 'thinking', 'sure', 'unsure', 'lost', 'happy', 'oops', 'shot', 'learned', 'reset', 'right', 'wrong', 'class_added'] as const;
  for (const k of keys) {
    for (let seed = 0; seed < 4; seed++) {
      const l = lineFor(k, { className: 'כוס', count: 7 }, seed);
      assert.ok(l.length > 0 && l.length <= 60, `${k}/${seed} is short`);
      assert.doesNotMatch(l, /%|\{/, `${k}/${seed} has no leftovers`);
    }
  }
});

test('missing context falls back to words, never to "undefined"', () => {
  assert.equal(lineFor('sure'), 'זה משהו, אני בטוח');
  assert.equal(lineFor('learned', { className: 'כוס' }), 'יש! למדתי כמה תמונות של כוס');
  assert.doesNotMatch(lineFor('class_added', { className: null }), /undefined|null/);
});

test('joinHe reads like Hebrew', () => {
  assert.equal(joinHe([]), '');
  assert.equal(joinHe(['כוס']), 'כוס');
  assert.equal(joinHe(['כוס', 'נעל']), 'כוס ונעל');
  assert.equal(joinHe(['כוס', 'נעל', 'ספר']), 'כוס, נעל וספר');
});

test('speech is gated to mood changes, one line per 4s', () => {
  assert.equal(shouldSpeak('sure', 'sure', 0, 10_000), false, 'same mood is silent');
  assert.equal(shouldSpeak('sure', 'lost', 0, 10_000), true);
  assert.equal(shouldSpeak('sure', 'lost', 10_000, 10_000 + SPEAK_GAP_MS - 1), false, 'too soon');
  assert.equal(shouldSpeak('sure', 'lost', 10_000, 10_000 + SPEAK_GAP_MS), true);
  assert.equal(shouldSpeak('idle', 'sure', -Infinity, 0), true, 'first line ever');
});

test('antenna light mirrors the bar', () => {
  assert.equal(lightTone('sure'), 'teal');
  assert.equal(lightTone('unsure'), 'amber');
  assert.equal(lightTone('lost'), 'red');
  assert.equal(lightTone('idle'), 'off');
  assert.equal(lightTone('sleep'), 'off');
});
