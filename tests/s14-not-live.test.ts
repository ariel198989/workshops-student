import { test } from 'node:test';
import assert from 'node:assert/strict';
import { captureAllowed, createRetryQueue, isNotLiveRejection, WORKSHOP_NOT_LIVE } from '../lib/cv/capture-utils.ts';

test('capture is open only while the workshop is live', () => {
  assert.equal(captureAllowed('live'), true);
  for (const s of ['draft', 'confirmed', 'completed', 'cancelled', '', null, undefined, 'LIVE']) {
    assert.equal(captureAllowed(s), false, String(s));
  }
});

test('a Postgres 42501 on the ws_photos insert is the not-live rejection', () => {
  assert.equal(isNotLiveRejection({ code: '42501', message: 'new row violates row-level security policy for table "ws_photos"' }), true);
  assert.equal(isNotLiveRejection({ code: '42501', message: 'permission denied' }), true);
});

test('a Storage RLS refusal on the ws-media upload is the not-live rejection', () => {
  // the shape storage-js gives: StorageApiError with statusCode '403'
  assert.equal(isNotLiveRejection({ name: 'StorageApiError', statusCode: '403', status: 400, message: 'new row violates row-level security policy' }), true);
  assert.equal(isNotLiveRejection(new Error('new row violates row level security policy')), true);
});

test('other failures are not mistaken for it', () => {
  assert.equal(isNotLiveRejection(null), false);
  assert.equal(isNotLiveRejection('42501'), false);
  assert.equal(isNotLiveRejection({ code: '23505', message: 'duplicate key value' }), false);
  assert.equal(isNotLiveRejection({ statusCode: '409', message: 'The resource already exists' }), false);
  assert.equal(isNotLiveRejection(new TypeError('Failed to fetch')), false);
  assert.equal(isNotLiveRejection({ statusCode: '400', message: 'jwt expired' }), false);
});

test('the message is the Hebrew one the student sees', () => {
  assert.equal(WORKSHOP_NOT_LIVE, 'הסדנה לא פעילה כרגע, אפשר לצלם רק בזמן מפגש');
});

test('the retry queue reports the last failure, so the screen can name the not-live refusal at once', async () => {
  let refuse = true;
  const q = createRetryQueue<string>(async () => { if (refuse) throw new Error(WORKSHOP_NOT_LIVE); });
  q.submit('a');
  await q.idle();
  assert.equal(q.stats().failing, true);
  assert.equal(q.stats().failures, 1);
  assert.equal(q.stats().error, WORKSHOP_NOT_LIVE);
  refuse = false;
  await q.retryNow();
  assert.equal(q.stats().failing, false);
  assert.equal(q.stats().error, null);
});
