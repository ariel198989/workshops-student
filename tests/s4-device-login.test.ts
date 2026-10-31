import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEVICE_LOGIN_URL, DeviceLoginError, EMPTY_PIN, GROUP_NUMBERS, PIN_LENGTH, deviceLoginErrorMessage, pinComplete, pinReducer,
  requestDeviceLogin, validateDeviceLogin,
} from '../lib/student/device-login.ts';

test('constants: 4-digit PIN, groups 1..12, the ws-device-login function URL', () => {
  assert.equal(PIN_LENGTH, 4);
  assert.deepEqual([...GROUP_NUMBERS], [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  assert.match(DEVICE_LOGIN_URL, /\/functions\/v1\/ws-device-login$/);
});

test('error mapping: every status of the edge function has Hebrew', () => {
  assert.equal(deviceLoginErrorMessage(401, { error: 'bad_pin', remaining: 2 }), 'הקוד הסודי לא נכון. נשארו 2 ניסיונות');
  assert.equal(deviceLoginErrorMessage(401, { error: 'bad_pin', remaining: 1 }), 'הקוד הסודי לא נכון. נשאר ניסיון אחד');
  assert.equal(deviceLoginErrorMessage(401, { error: 'bad_pin' }), 'הקוד הסודי לא נכון');
  assert.equal(deviceLoginErrorMessage(429, { error: 'locked', retry_minutes: 15 }), 'יותר מדי ניסיונות. חכו 15 דקות');
  assert.equal(deviceLoginErrorMessage(429, { error: 'locked' }), 'יותר מדי ניסיונות. חכו 15 דקות');
  assert.equal(deviceLoginErrorMessage(429, { error: 'locked', retry_minutes: 3.2 }), 'יותר מדי ניסיונות. חכו 4 דקות');
  assert.equal(deviceLoginErrorMessage(404, { error: 'not_found' }), 'לא מצאנו סדנה פתוחה עם הקוד והקבוצה האלה');
  assert.match(deviceLoginErrorMessage(400, { error: 'bad_request' }), /לא תקין/);
  assert.match(deviceLoginErrorMessage(503, null), /השרת לא זמין/);
  assert.match(deviceLoginErrorMessage(500, 'html'), /השרת לא זמין/);
});

test('validateDeviceLogin: code, group range, 4 digits', () => {
  assert.equal(validateDeviceLogin({ code: 'OFEK-H2-27', group: 3, pin: '1234' }), null);
  assert.equal(validateDeviceLogin({ code: 'ofek h2 27', group: 12, pin: '0007' }), null, 'the code is normalized first');
  assert.match(validateDeviceLogin({ code: 'AB', group: 3, pin: '1234' }) ?? '', /קוד הסדנה/);
  assert.match(validateDeviceLogin({ code: 'OFEK-H2-27', group: 0, pin: '1234' }) ?? '', /מספר קבוצה/);
  assert.match(validateDeviceLogin({ code: 'OFEK-H2-27', group: 13, pin: '1234' }) ?? '', /מספר קבוצה/);
  assert.match(validateDeviceLogin({ code: 'OFEK-H2-27', group: 2.5, pin: '1234' }) ?? '', /מספר קבוצה/);
  assert.match(validateDeviceLogin({ code: 'OFEK-H2-27', group: 3, pin: '123' }) ?? '', /4 ספרות/);
  assert.match(validateDeviceLogin({ code: 'OFEK-H2-27', group: 3, pin: '12a4' }) ?? '', /4 ספרות/);
});

test('pinReducer: digits only, capped at 4, back and clear', () => {
  let s = EMPTY_PIN;
  s = pinReducer(s, { type: 'digit', value: '1' });
  s = pinReducer(s, { type: 'digit', value: 'x' });
  s = pinReducer(s, { type: 'digit', value: '23' });
  assert.equal(s.digits, '1');
  s = pinReducer(s, { type: 'digit', value: '2' });
  s = pinReducer(s, { type: 'digit', value: '3' });
  assert.equal(pinComplete(s), false);
  s = pinReducer(s, { type: 'digit', value: '4' });
  assert.equal(s.digits, '1234');
  assert.equal(pinComplete(s), true);
  assert.equal(pinReducer(s, { type: 'digit', value: '5' }), s, 'a full PIN ignores more digits (same object)');
  s = pinReducer(s, { type: 'back' });
  assert.equal(s.digits, '123');
  assert.deepEqual(pinReducer(s, { type: 'clear' }), EMPTY_PIN);
  assert.equal(pinReducer(EMPTY_PIN, { type: 'back' }), EMPTY_PIN);
  assert.equal(pinReducer(EMPTY_PIN, { type: 'clear' }), EMPTY_PIN);
});

interface Call { url: string; init: RequestInit }

const fakeFetch = (status: number, body: unknown, calls: Call[] = []) => async (url: string, init: RequestInit) => {
  calls.push({ url, init });
  return { status, ok: status >= 200 && status < 300, json: async () => body };
};

test('requestDeviceLogin posts the normalized code, the group and the PIN with the apikey header', async () => {
  const calls: Call[] = [];
  const ok = { ok: true, email: 'g3@device.local', password: 'p', workshop: { id: 'w', title: 'ת' }, group: { id: 'g', number: 3, label: 'קבוצה 3' } };
  const res = await requestDeviceLogin({ code: 'ofek h2 27', group: 3, pin: '1234' }, fakeFetch(200, ok, calls));
  assert.equal(res.email, 'g3@device.local');
  assert.equal(res.password, 'p');
  assert.equal(res.group.number, 3);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, DEVICE_LOGIN_URL);
  assert.equal(calls[0].init.method, 'POST');
  const headers = calls[0].init.headers as Record<string, string>;
  assert.equal(headers['content-type'], 'application/json');
  assert.match(headers.apikey, /^sb_publishable_/);
  assert.deepEqual(JSON.parse(calls[0].init.body as string), { code: 'OFEK-H2-27', group: 3, pin: '1234' });
});

test('requestDeviceLogin maps a 401 to the Hebrew bad-PIN line and never sends an invalid form', async () => {
  const calls: Call[] = [];
  await assert.rejects(
    requestDeviceLogin({ code: 'OFEK-H2-27', group: 3, pin: '0000' }, fakeFetch(401, { error: 'bad_pin', remaining: 4 }, calls)),
    (e: unknown) => e instanceof DeviceLoginError && e.message === 'הקוד הסודי לא נכון. נשארו 4 ניסיונות',
  );
  await assert.rejects(requestDeviceLogin({ code: 'X', group: 3, pin: '0000' }, fakeFetch(200, {}, calls)), DeviceLoginError);
  assert.equal(calls.length, 1, 'the invalid code was rejected before any network call');
});

test('requestDeviceLogin: a 200 with an unexpected body and a network failure both become Hebrew errors', async () => {
  await assert.rejects(requestDeviceLogin({ code: 'OFEK-H2-27', group: 1, pin: '1111' }, fakeFetch(200, { ok: false })),
    (e: unknown) => e instanceof DeviceLoginError && /השרת לא זמין/.test(e.message));
  const offline = async () => { throw new TypeError('Failed to fetch'); };
  await assert.rejects(requestDeviceLogin({ code: 'OFEK-H2-27', group: 1, pin: '1111' }, offline),
    (e: unknown) => e instanceof DeviceLoginError && /אין חיבור/.test(e.message));
});
