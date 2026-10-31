import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  classCounts, confidenceWord, describeGuess, imagesHe, isShareToken, normalizeShared, NOTHING_GUESS, TAKE_HOME_COPY,
  takeHomeState, WAITING_GUESS,
} from '../lib/takehome/shared-model.ts';
import { isPublicPath } from '../lib/student/access.ts';
import type { Decoded } from '../lib/cv/yolo.ts';

const model = { id: 'm1', zip_path: 'models/g1.zip', classes: ['פח', 'ספסל'], class_stats: [{ name: 'פח', ap50: 0.8, boxes: 120 }], accuracy: 0.8, image_count: 150, created_at: '2026-10-20' };
const shared = { workshop: 'ראייה ממוחשבת', organization: 'אורט', group: 'קבוצה 3', status: 'completed', model };

test('/model/<token> is a public path, /modeling is not', () => {
  assert.equal(isPublicPath('/model'), true);
  assert.equal(isPublicPath('/model/abc234'), true);
  assert.equal(isPublicPath('/modeling'), false);
});

test('isShareToken matches the server regex: 6..24 of a-z 2-9', () => {
  assert.equal(isShareToken('abc234'), true);
  assert.equal(isShareToken('abcdefghjkmn'), true);
  assert.equal(isShareToken('abc12'), false, 'too short');
  assert.equal(isShareToken('ABC234'), false, 'uppercase');
  assert.equal(isShareToken('abc1234'), false, 'digits 0 and 1 are not in the alphabet');
  assert.equal(isShareToken(''), false);
  assert.equal(isShareToken(null), false);
});

test('normalizeShared: the RPC shape, a null model, and garbage', () => {
  const s = normalizeShared(shared);
  assert.equal(s?.group, 'קבוצה 3');
  assert.equal(s?.model?.zip_path, 'models/g1.zip');
  assert.deepEqual(s?.model?.classes, ['פח', 'ספסל']);
  assert.equal(normalizeShared({ ...shared, model: null })?.model, null);
  assert.equal(normalizeShared({ ...shared, model: { id: 'x' } })?.model, null, 'a model without zip_path is no model');
  assert.equal(normalizeShared(null), null);
  assert.equal(normalizeShared({ workshop: 'x' }), null);
});

test('takeHomeState: bad token, not found, not open, no model, ready', () => {
  assert.deepEqual(takeHomeState('BAD', shared), { kind: 'bad-token' });
  assert.deepEqual(takeHomeState('abc234', null), { kind: 'not-found' });
  assert.equal(takeHomeState('abc234', { ...shared, status: 'draft' }).kind, 'not-open');
  assert.equal(takeHomeState('abc234', { ...shared, model: null }).kind, 'no-model');
  const ready = takeHomeState('abc234', shared);
  assert.equal(ready.kind, 'ready');
  if (ready.kind === 'ready') assert.equal(ready.model.id, 'm1');
  assert.equal(takeHomeState('abc234', { ...shared, status: 'live' }).kind, 'ready');
});

test('copy: the three waiting states and the privacy line', () => {
  assert.equal(TAKE_HOME_COPY.badToken, 'הקישור לא תקין');
  assert.equal(TAKE_HOME_COPY.noModel, 'המודל עוד לא מוכן. חזרו אחרי יום ההצגה');
  assert.equal(TAKE_HOME_COPY.privacy, 'התמונות לא נשמרות ולא נשלחות לשום מקום');
});

test('confidenceWord bands', () => {
  assert.equal(confidenceWord(0.95), 'בטוח מאוד');
  assert.equal(confidenceWord(0.85), 'בטוח מאוד');
  assert.equal(confidenceWord(0.7), 'די בטוח');
  assert.equal(confidenceWord(0.45), 'לא בטוח');
  assert.equal(confidenceWord(0.2), 'מנחש');
});

const box = (cls: number, score: number) => ({ x: 0.1, y: 0.1, w: 0.3, h: 0.3, cls, score });

test('describeGuess: plain Hebrew from the strongest box', () => {
  assert.equal(describeGuess(null, ['פח']), WAITING_GUESS);
  const two: Decoded = { boxes: [box(1, 0.5), box(0, 0.72)], top: box(0, 0.72), lowGuess: false };
  assert.equal(describeGuess(two, ['פח', 'ספסל']), 'המחשב חושב: פח, די בטוח');
  const none: Decoded = { boxes: [], top: box(1, 0.2), lowGuess: true };
  assert.equal(describeGuess(none, ['פח', 'ספסל']), `${NOTHING_GUESS}. הכי קרוב: ספסל`);
  assert.equal(describeGuess({ boxes: [], top: null, lowGuess: true }, []), NOTHING_GUESS);
  assert.equal(describeGuess({ boxes: [box(4, 0.9)], top: null, lowGuess: false }, ['פח']), 'המחשב חושב: אובייקט 5, בטוח מאוד');
});

test('classCounts: class order from the model, counts from class_stats boxes when present', () => {
  assert.deepEqual(classCounts(['פח', 'ספסל'], model.class_stats), [{ name: 'פח', images: 120 }, { name: 'ספסל', images: null }]);
  assert.deepEqual(classCounts([], [{ name: 'א', boxes: 3 }]), [{ name: 'א', images: 3 }], 'no classes: fall back to the stats');
  assert.deepEqual(classCounts(['א'], 'junk'), [{ name: 'א', images: null }]);
  assert.equal(imagesHe(1), 'תמונה אחת');
  assert.equal(imagesHe(120), '120 תמונות');
});

// ── the QR on the certificate ──
import { takeHomeUrl, TAKE_HOME_QR_CAPTION } from '../lib/student/share.ts';

test('takeHomeUrl: origin + /model/<token>; null without a token', () => {
  assert.equal(takeHomeUrl('https://ws.example', 'abc234'), 'https://ws.example/model/abc234');
  assert.equal(takeHomeUrl('https://ws.example/', ' abc234 '), 'https://ws.example/model/abc234');
  assert.equal(takeHomeUrl('https://ws.example', null), null);
  assert.equal(takeHomeUrl('https://ws.example', undefined), null);
  assert.equal(takeHomeUrl('https://ws.example', '  '), null);
  assert.equal(TAKE_HOME_QR_CAPTION, 'סרקו: המודל שלנו רץ אצלכם בטלפון');
});
