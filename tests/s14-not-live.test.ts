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

test('a policy refusal is "not live" only when the reloaded context says so; otherwise it is the session', async () => {
  const { classifyRefusal } = await import('../lib/cv/capture-utils.ts');
  assert.equal(classifyRefusal('completed'), 'not-live');
  assert.equal(classifyRefusal('confirmed'), 'not-live');
  assert.equal(classifyRefusal('live'), 'session', 'live but refused: the session, not the workshop');
  assert.equal(classifyRefusal(undefined), 'session', 'context could not be reloaded');
  assert.equal(classifyRefusal(null), 'session');
});

test('isAuthError: 401 and the JWT messages, nothing else', async () => {
  const { isAuthError } = await import('../lib/cv/capture-utils.ts');
  assert.equal(isAuthError({ statusCode: '401', message: 'Unauthorized' }), true);
  assert.equal(isAuthError({ status: 401 }), true);
  assert.equal(isAuthError(new Error('JWT expired')), true);
  assert.equal(isAuthError({ code: '42501', message: 'new row violates row-level security policy' }), false);
  assert.equal(isAuthError(new TypeError('Failed to fetch')), false);
  assert.equal(isAuthError(null), false);
});

test('a fatal upload error halts automatic retries until a tap (retryNow)', async () => {
  const { createRetryQueue, FatalUploadError, SESSION_EXPIRED } = await import('../lib/cv/capture-utils.ts');
  let calls = 0;
  let expired = true;
  const q = createRetryQueue<string>(async () => { calls += 1; if (expired) throw new FatalUploadError(SESSION_EXPIRED); });
  q.submit('a');
  await q.idle();
  assert.equal(q.stats().halted, true);
  assert.equal(q.stats().error, SESSION_EXPIRED);
  q.submit('b'); // a new shot does not hammer the server again
  await q.idle();
  assert.equal(calls, 1);
  expired = false; // signed in again
  await q.retryNow();
  assert.equal(q.stats().halted, false);
  assert.equal(q.stats().queued, 0);
  assert.equal(calls, 3);
});

test('an ordinary failure (offline) does not halt the queue', async () => {
  const { createRetryQueue } = await import('../lib/cv/capture-utils.ts');
  const q = createRetryQueue<string>(async () => { throw new Error('offline'); });
  q.submit('a');
  await q.idle();
  assert.equal(q.stats().failing, true);
  assert.equal(q.stats().halted, false);
});
