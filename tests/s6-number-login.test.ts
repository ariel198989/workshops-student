import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DeviceLoginError, hasCredentials, PIN_LENGTH, postDeviceLogin, postDeviceLoginAs, requestDeviceLogin,
} from '../lib/student/device-login.ts';
import { requestJoinTokenLogin } from '../lib/student/join-token.ts';
import {
  isWorkshopNumber, joinCodeOf, LAST_ATTEMPT, normalizeWorkshopNumber, NUMBER_BAD_REQUEST, NUMBER_NOT_FOUND, NUMBER_OFFLINE,
  numberLoginErrorMessage, numberLoginFailureMessage, requestNumberLogin, SEARCHING, WORKSHOP_NUMBER_LENGTH,
} from '../lib/student/number-login.ts';
import { isCodeComplete, normalizeCode } from '../lib/student/code.ts';
import { clearPendingCode, peekPendingCode, PENDING_CODE_KEY, storePendingCode, type StorageLike } from '../lib/student/pending.ts';

const DEVICE = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdef';

const okBody = {
  ok: true, email: 'dev-abc@devices.corewise.local', password: 'secret',
  workshop: { id: 'w1', title: 'ראייה ממוחשבת', code: 'OFEK-H2-27', short_code: '1357' },
};
const groupBody = {
  ok: true, email: 'g3@device.local', password: 'secret',
  workshop: { id: 'w1', title: 'ראייה ממוחשבת' }, group: { id: 'g1', number: 3, label: 'קבוצה 3' },
};

const answer = (status: number, body: unknown) => async () => ({ status, ok: status >= 200 && status < 300, json: async () => body });

function fakeStorage(): StorageLike & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => { data.set(k, v); }, removeItem: (k) => { data.delete(k); } };
}

// ── the number itself ──

test('isWorkshopNumber: exactly 4 digits; the keypad reducer caps at the same length', () => {
  assert.equal(WORKSHOP_NUMBER_LENGTH, 4);
  assert.equal(PIN_LENGTH, WORKSHOP_NUMBER_LENGTH, 'NumberEntry reuses pinReducer, so the two lengths must agree');
  assert.equal(isWorkshopNumber('1357'), true);
  assert.equal(isWorkshopNumber('0000'), true);
  assert.equal(isWorkshopNumber('135'), false);
  assert.equal(isWorkshopNumber('13579'), false);
  assert.equal(isWorkshopNumber('13a7'), false);
  assert.equal(isWorkshopNumber(' 1357'), false);
  assert.equal(isWorkshopNumber('OFEK-H2-27'), false);
  assert.equal(isWorkshopNumber(''), false);
  assert.equal(isWorkshopNumber(null), false);
  assert.equal(isWorkshopNumber(undefined), false);
});

test('normalizeWorkshopNumber keeps digits only', () => {
  assert.equal(normalizeWorkshopNumber('13 57'), '1357');
  assert.equal(normalizeWorkshopNumber(' 1357\n'), '1357');
  assert.equal(normalizeWorkshopNumber('1-3-5-7'), '1357');
  assert.equal(normalizeWorkshopNumber(null), '');
  assert.equal(normalizeWorkshopNumber(undefined), '');
});

test('a 4-digit number passes the existing code helpers, so it rides the join flow and the pending-code storage as is', () => {
  assert.equal(normalizeCode('1357'), '1357');
  assert.equal(isCodeComplete(normalizeCode('1357')), true);
  const st = fakeStorage();
  assert.equal(storePendingCode(st, '1357'), '1357');
  assert.equal(peekPendingCode(st), '1357');
  clearPendingCode(st);
  assert.equal(st.data.has(PENDING_CODE_KEY), false);
  assert.doesNotThrow(() => clearPendingCode(null));
});

test('joinCodeOf: the typed number goes straight through; otherwise the server short code, then the code', () => {
  assert.equal(joinCodeOf(okBody.workshop, '1357'), '1357');
  assert.equal(joinCodeOf(okBody.workshop, 'typed-junk'), '1357');
  assert.equal(joinCodeOf({ ...okBody.workshop, short_code: '' }, 'x'), 'OFEK-H2-27');
});

// ── copy ──

test('numberLoginErrorMessage: 404 with remaining under 3, 429 with minutes, 400 about the digits', () => {
  assert.equal(numberLoginErrorMessage(404, { error: 'not_found' }), NUMBER_NOT_FOUND);
  assert.equal(numberLoginErrorMessage(404, { error: 'not_found', remaining: 5 }), NUMBER_NOT_FOUND, '3 or more left: no count');
  assert.equal(numberLoginErrorMessage(404, { error: 'not_found', remaining: 3 }), NUMBER_NOT_FOUND);
  assert.equal(numberLoginErrorMessage(404, { error: 'not_found', remaining: 2 }), `${NUMBER_NOT_FOUND}. נשארו 2 ניסיונות`);
  assert.equal(numberLoginErrorMessage(404, { error: 'not_found', remaining: 1 }), `${NUMBER_NOT_FOUND}. נשאר ניסיון אחד`);
  assert.equal(numberLoginErrorMessage(404, { error: 'not_found', remaining: 0 }), `${NUMBER_NOT_FOUND}. ${LAST_ATTEMPT}`);
  assert.equal(numberLoginErrorMessage(404, { error: 'not_found', remaining: -1 }), NUMBER_NOT_FOUND, 'nonsense is ignored');
  assert.equal(numberLoginErrorMessage(429, { error: 'locked', retry_minutes: 15 }), 'יותר מדי ניסיונות. חכו 15 דקות');
  assert.equal(numberLoginErrorMessage(429, { error: 'locked' }), 'יותר מדי ניסיונות. חכו 15 דקות');
  assert.equal(numberLoginErrorMessage(400, { error: 'bad_request' }), NUMBER_BAD_REQUEST);
  assert.match(numberLoginErrorMessage(500, null), /השרת לא זמין/);
  assert.equal(NUMBER_NOT_FOUND, 'אין סדנה פתוחה עם המספר הזה. בדקו עם המדריך');
  assert.equal(NUMBER_OFFLINE, 'אין חיבור. נסו שוב');
  assert.equal(SEARCHING, 'מחפשים את הסדנה...');
  for (const s of [NUMBER_NOT_FOUND, NUMBER_BAD_REQUEST, NUMBER_OFFLINE, SEARCHING, LAST_ATTEMPT, numberLoginErrorMessage(404, { remaining: 1 })]) {
    assert.doesNotMatch(s, /[—–]/, 'no dashes in Hebrew copy');
  }
});

test('numberLoginFailureMessage: network gets the short offline line, other kinds keep their message, strangers get the server line', () => {
  assert.equal(numberLoginFailureMessage(new DeviceLoginError('whatever', 'network')), NUMBER_OFFLINE);
  assert.equal(numberLoginFailureMessage(new DeviceLoginError(NUMBER_NOT_FOUND, 'not_found')), NUMBER_NOT_FOUND);
  assert.equal(numberLoginFailureMessage(new DeviceLoginError('locked', 'locked')), 'locked');
  assert.match(numberLoginFailureMessage(new DeviceLoginError('', 'server')), /השרת לא זמין/);
  assert.match(numberLoginFailureMessage(new TypeError('boom')), /השרת לא זמין/);
  assert.match(numberLoginFailureMessage(undefined), /השרת לא זמין/);
});

// ── the request ──

test('requestNumberLogin posts {workshop_number, device_id} and returns credentials + workshop', async () => {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const fetchImpl = async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return { status: 200, ok: true, json: async () => okBody };
  };
  const ok = await requestNumberLogin('13 57', DEVICE, fetchImpl);
  assert.equal(calls.length, 1);
  assert.match(calls[0].url, /ws-device-login$/);
  assert.deepEqual(JSON.parse(String(calls[0].init.body)), { workshop_number: '1357', device_id: DEVICE });
  const headers = calls[0].init.headers as Record<string, string>;
  assert.equal(headers['content-type'], 'application/json');
  assert.ok(headers.apikey);
  assert.equal(ok.email, okBody.email);
  assert.equal(ok.password, okBody.password);
  assert.deepEqual(ok.workshop, okBody.workshop);
});

test('requestNumberLogin fills a missing code / short_code with the typed number', async () => {
  const bare = { ok: true, email: 'e', password: 'p', workshop: { id: 'w1', title: 't' } };
  const ok = await requestNumberLogin('1357', DEVICE, answer(200, bare));
  assert.deepEqual(ok.workshop, { id: 'w1', title: 't', code: '1357', short_code: '1357' });
});

test('requestNumberLogin refuses a bad number or device id before any network call', async () => {
  let called = 0;
  const fetchImpl = async () => { called++; return { status: 200, ok: true, json: async () => okBody }; };
  await assert.rejects(requestNumberLogin('135', DEVICE, fetchImpl), (e: unknown) =>
    e instanceof DeviceLoginError && e.kind === 'bad_request' && e.message === NUMBER_BAD_REQUEST);
  await assert.rejects(requestNumberLogin('abcd', DEVICE, fetchImpl), (e: unknown) => e instanceof DeviceLoginError && e.kind === 'bad_request');
  await assert.rejects(requestNumberLogin('1357', 'short', fetchImpl), (e: unknown) => e instanceof DeviceLoginError && e.kind === 'bad_request');
  assert.equal(called, 0);
});

test('requestNumberLogin: 404 → not_found with remaining, 429 → locked, thrown fetch → network, odd 200 → server', async () => {
  await assert.rejects(requestNumberLogin('1357', DEVICE, answer(404, { error: 'not_found', remaining: 2 })), (e: unknown) =>
    e instanceof DeviceLoginError && e.kind === 'not_found' && e.message === `${NUMBER_NOT_FOUND}. נשארו 2 ניסיונות`);
  await assert.rejects(requestNumberLogin('1357', DEVICE, answer(429, { error: 'locked', retry_minutes: 15 })), (e: unknown) =>
    e instanceof DeviceLoginError && e.kind === 'locked' && e.message === 'יותר מדי ניסיונות. חכו 15 דקות');
  await assert.rejects(requestNumberLogin('1357', DEVICE, async () => { throw new TypeError('Failed to fetch'); }), (e: unknown) =>
    e instanceof DeviceLoginError && e.kind === 'network');
  await assert.rejects(requestNumberLogin('1357', DEVICE, answer(200, { ok: true, email: 'e', password: 'p' })), (e: unknown) =>
    e instanceof DeviceLoginError && e.kind === 'server', 'a 200 without a workshop is a server problem');
  const loose = await requestNumberLogin('1357', DEVICE, answer(200, groupBody));
  assert.equal(loose.workshop.code, '1357', 'a workshop with id + title but no code is accepted; the typed number fills the gap');
});

// ── the shared poster keeps the two older doors intact ──

test('hasCredentials: ok + email + password', () => {
  assert.equal(hasCredentials(okBody), true);
  assert.equal(hasCredentials(groupBody), true);
  assert.equal(hasCredentials({ ok: true, email: 'e' }), false);
  assert.equal(hasCredentials({ ok: false, email: 'e', password: 'p' }), false);
  assert.equal(hasCredentials(null), false);
  assert.equal(hasCredentials('html'), false);
});

test('postDeviceLoginAs returns whatever its own guard accepts', async () => {
  const isEcho = (v: unknown): v is { ok: true; echo: string } => !!v && typeof v === 'object' && typeof (v as { echo?: unknown }).echo === 'string';
  const got = await postDeviceLoginAs({ join_token: 'x'.repeat(20) }, () => 'err', isEcho, answer(200, { ok: true, echo: 'hi' }));
  assert.equal(got.echo, 'hi');
  await assert.rejects(postDeviceLoginAs({ join_token: 'x'.repeat(20) }, () => 'err', isEcho, answer(200, { ok: true })), (e: unknown) =>
    e instanceof DeviceLoginError && e.kind === 'server');
  await assert.rejects(postDeviceLoginAs({ join_token: 'x'.repeat(20) }, (s) => `status ${s}`, isEcho, answer(404, {})), (e: unknown) =>
    e instanceof DeviceLoginError && e.kind === 'not_found' && e.message === 'status 404');
});

test('the PIN and QR doors still demand a group in the answer', async () => {
  const pin = await requestDeviceLogin({ code: 'OFEK-H2-27', group: 3, pin: '1234' }, answer(200, groupBody));
  assert.equal(pin.group.label, 'קבוצה 3');
  const qr = await requestJoinTokenLogin('abcdefghjkmnpqrstuvw', answer(200, groupBody));
  assert.equal(qr.group.number, 3);
  await assert.rejects(postDeviceLogin({ join_token: 'abcdefghjkmnpqrstuvw' }, undefined, answer(200, okBody)), (e: unknown) =>
    e instanceof DeviceLoginError && e.kind === 'server', 'a number-door answer (no group) does not satisfy the group doors');
});
