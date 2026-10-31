import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isPublicPath } from '../lib/student/access.ts';
import { DeviceLoginError, deviceLoginFailureKind, requestDeviceLogin } from '../lib/student/device-login.ts';
import {
  INVALID_LINK_FAILURE, isJoinToken, JOIN_TOKEN_LENGTH, joinLinkFailure, joinTokenErrorMessage, LINK_INACTIVE, LINK_INVALID,
  normalizeJoinToken, requestJoinTokenLogin, WELCOME_MS, welcomeMessage,
} from '../lib/student/join-token.ts';
import {
  codeFromSearch, ENTRY_HINT_KEY, peekPendingCode, PENDING_CODE_KEY, storeEntryHint, storePendingCode, takeEntryHint, takePendingCode,
  type StorageLike,
} from '../lib/student/pending.ts';

const TOKEN = 'abcdefghjkmnpqrstuvw'; // 20 of a-z 2-9

function fakeStorage(initial: Record<string, string> = {}): StorageLike & { data: Map<string, string> } {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => { data.set(k, v); },
    removeItem: (k) => { data.delete(k); },
  };
}

function throwingStorage(): StorageLike {
  const boom = () => { throw new Error('blocked'); };
  return { getItem: boom, setItem: boom, removeItem: boom };
}

const okBody = {
  ok: true, email: 'g3@device.local', password: 'secret',
  workshop: { id: 'w1', title: 'ראייה ממוחשבת' }, group: { id: 'g1', number: 3, label: 'קבוצה 3' },
};

const answer = (status: number, body: unknown) => async () => ({ status, ok: status >= 200 && status < 300, json: async () => body });

// ── routing ──

test('/g and /g/<token> are public paths; /go and /group are not', () => {
  assert.equal(isPublicPath('/g'), true);
  assert.equal(isPublicPath(`/g/${TOKEN}`), true);
  assert.equal(isPublicPath('/g/not-a-token'), true, 'the page itself explains a bad token');
  assert.equal(isPublicPath('/go'), false);
  assert.equal(isPublicPath('/group'), false);
  assert.equal(isPublicPath('/gallery/1'), false);
});

// ── token shape ──

test('isJoinToken: exactly 20 of a-z 2-9, nothing else', () => {
  assert.equal(JOIN_TOKEN_LENGTH, 20);
  assert.equal(TOKEN.length, 20);
  assert.equal(isJoinToken(TOKEN), true);
  assert.equal(isJoinToken('abcdefghjkmnpqrstuv'), false, '19 chars');
  assert.equal(isJoinToken(`${TOKEN}x`), false, '21 chars');
  assert.equal(isJoinToken('abcdefghjkmnpqrstuv1'), false, 'no 0/1');
  assert.equal(isJoinToken('ABCDEFGHJKMNPQRSTUVW'), false, 'uppercase is normalised before the check, never accepted raw');
  assert.equal(isJoinToken('abcdefghjkmnpqrstu-w'), false);
  assert.equal(isJoinToken(''), false);
  assert.equal(isJoinToken(null), false);
  assert.equal(isJoinToken(undefined), false);
});

test('normalizeJoinToken: decodes, trims, lowercases, never throws', () => {
  assert.equal(normalizeJoinToken(' ABCDEFGHJKMNPQRSTUVW '), TOKEN);
  assert.equal(normalizeJoinToken(encodeURIComponent(TOKEN)), TOKEN);
  assert.equal(normalizeJoinToken('%E0%A4%A'), '%e0%a4%a', 'a broken escape is kept as text, not thrown');
  assert.equal(normalizeJoinToken(''), '');
  assert.equal(normalizeJoinToken(null), '');
  assert.equal(normalizeJoinToken(undefined), '');
  assert.equal(isJoinToken(normalizeJoinToken('ABCDEFGHJKMNPQRSTUVW')), true);
});

// ── copy ──

test('welcomeMessage does not say קבוצה twice', () => {
  assert.equal(welcomeMessage('קבוצה 3'), 'מחוברים! ברוכים הבאים לקבוצה 3');
  assert.equal(welcomeMessage('הנמרים'), 'מחוברים! ברוכים הבאים לקבוצה הנמרים');
  assert.equal(welcomeMessage('  קבוצה   7 '), 'מחוברים! ברוכים הבאים לקבוצה 7');
  assert.equal(welcomeMessage(''), 'מחוברים! ברוכים הבאים לקבוצה');
  assert.equal(welcomeMessage(null), 'מחוברים! ברוכים הבאים לקבוצה');
  assert.equal(WELCOME_MS, 1000);
});

test('joinTokenErrorMessage: 404 and 400 talk about the link, the rest falls back to the device-login copy', () => {
  assert.equal(joinTokenErrorMessage(404, { error: 'not_found' }), LINK_INACTIVE);
  assert.equal(joinTokenErrorMessage(404, { error: 'not_live' }), LINK_INACTIVE);
  assert.equal(joinTokenErrorMessage(400, { error: 'bad_request' }), LINK_INVALID);
  assert.equal(joinTokenErrorMessage(429, { error: 'locked', retry_minutes: 5 }), 'יותר מדי ניסיונות. חכו 5 דקות');
  assert.match(joinTokenErrorMessage(500, null), /השרת לא זמין/);
  for (const s of [LINK_INACTIVE, LINK_INVALID, welcomeMessage('3')]) assert.doesNotMatch(s, /[—–]/, 'no dashes in Hebrew copy');
});

// ── failure kinds → screen ──

test('deviceLoginFailureKind maps the edge function statuses', () => {
  assert.equal(deviceLoginFailureKind(400), 'bad_request');
  assert.equal(deviceLoginFailureKind(401), 'bad_pin');
  assert.equal(deviceLoginFailureKind(404), 'not_found');
  assert.equal(deviceLoginFailureKind(429), 'locked');
  assert.equal(deviceLoginFailureKind(500), 'server');
  assert.equal(new DeviceLoginError('x').kind, 'server', 'the default keeps older callers working');
});

test('joinLinkFailure: retry for network, manual entry for a dead link, neither while locked', () => {
  assert.deepEqual(joinLinkFailure(new DeviceLoginError('offline', 'network')), { message: 'offline', retry: true, manual: false });
  assert.deepEqual(joinLinkFailure(new DeviceLoginError(LINK_INACTIVE, 'not_found')), { message: LINK_INACTIVE, retry: false, manual: true });
  assert.deepEqual(joinLinkFailure(new DeviceLoginError(LINK_INVALID, 'bad_request')), INVALID_LINK_FAILURE);
  assert.deepEqual(joinLinkFailure(new DeviceLoginError('locked', 'locked')), { message: 'locked', retry: false, manual: false });
  assert.deepEqual(joinLinkFailure(new DeviceLoginError('server', 'server')), { message: 'server', retry: true, manual: true });
  const unknown = joinLinkFailure(new TypeError('boom'));
  assert.equal(unknown.retry, true);
  assert.equal(unknown.manual, true);
  assert.match(unknown.message, /השרת לא זמין/);
});

// ── the request itself ──

test('requestJoinTokenLogin posts {join_token} alone and returns the credentials', async () => {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const fetchImpl = async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return { status: 200, ok: true, json: async () => okBody };
  };
  const ok = await requestJoinTokenLogin(TOKEN, fetchImpl);
  assert.equal(calls.length, 1);
  assert.match(calls[0].url, /ws-device-login$/);
  assert.deepEqual(JSON.parse(String(calls[0].init.body)), { join_token: TOKEN });
  assert.equal(ok.email, okBody.email);
  assert.equal(ok.group.label, 'קבוצה 3');
});

test('requestJoinTokenLogin refuses a malformed token before any network call', async () => {
  let called = 0;
  const fetchImpl = async () => { called++; return { status: 200, ok: true, json: async () => okBody }; };
  await assert.rejects(requestJoinTokenLogin('nope', fetchImpl), (e: unknown) =>
    e instanceof DeviceLoginError && e.kind === 'bad_request' && e.message === LINK_INVALID);
  assert.equal(called, 0);
});

test('requestJoinTokenLogin: 404 → not_found with the link copy, 429 → locked, thrown fetch → network', async () => {
  await assert.rejects(requestJoinTokenLogin(TOKEN, answer(404, { error: 'not_live' })), (e: unknown) =>
    e instanceof DeviceLoginError && e.kind === 'not_found' && e.message === LINK_INACTIVE);
  await assert.rejects(requestJoinTokenLogin(TOKEN, answer(429, { error: 'locked', retry_minutes: 15 })), (e: unknown) =>
    e instanceof DeviceLoginError && e.kind === 'locked');
  await assert.rejects(requestJoinTokenLogin(TOKEN, async () => { throw new TypeError('Failed to fetch'); }), (e: unknown) =>
    e instanceof DeviceLoginError && e.kind === 'network');
  await assert.rejects(requestJoinTokenLogin(TOKEN, answer(200, { ok: true })), (e: unknown) =>
    e instanceof DeviceLoginError && e.kind === 'server', 'a 200 without credentials is a server problem');
});

test('the PIN path still posts {code, group, pin} and still carries its own copy', async () => {
  const calls: unknown[] = [];
  const fetchImpl = async (_url: string, init: RequestInit) => {
    calls.push(JSON.parse(String(init.body)));
    return { status: 200, ok: true, json: async () => okBody };
  };
  await requestDeviceLogin({ code: 'ofek h2 27', group: 3, pin: '1234' }, fetchImpl);
  assert.deepEqual(calls, [{ code: 'OFEK-H2-27', group: 3, pin: '1234' }]);
  await assert.rejects(requestDeviceLogin({ code: 'OFEK-H2-27', group: 3, pin: '1234' }, answer(404, { error: 'not_found' })), (e: unknown) =>
    e instanceof DeviceLoginError && e.kind === 'not_found' && /לא מצאנו סדנה/.test(e.message));
  await assert.rejects(requestDeviceLogin({ code: 'AB', group: 3, pin: '1234' }, fetchImpl), (e: unknown) =>
    e instanceof DeviceLoginError && e.kind === 'bad_request');
});

// ── pending code through sign-up ──

test('codeFromSearch: normalised code or null', () => {
  assert.equal(codeFromSearch('?code=OFEK-H2-27'), 'OFEK-H2-27');
  assert.equal(codeFromSearch(new URLSearchParams('code=ofek%20h2%2027')), 'OFEK-H2-27');
  assert.equal(codeFromSearch('?code=AB'), null, 'too short');
  assert.equal(codeFromSearch('?other=1'), null);
  assert.equal(codeFromSearch(''), null);
  assert.equal(codeFromSearch(null), null);
  assert.equal(codeFromSearch(undefined), null);
});

test('pending code: store normalises, peek keeps, take consumes once', () => {
  const st = fakeStorage();
  assert.equal(PENDING_CODE_KEY, 'ws.pendingCode');
  assert.equal(storePendingCode(st, 'ofek h2 27'), 'OFEK-H2-27');
  assert.equal(st.data.get(PENDING_CODE_KEY), 'OFEK-H2-27');
  assert.equal(peekPendingCode(st), 'OFEK-H2-27');
  assert.equal(peekPendingCode(st), 'OFEK-H2-27', 'peek does not consume');
  assert.equal(takePendingCode(st), 'OFEK-H2-27');
  assert.equal(takePendingCode(st), null, 'consumed');
  assert.equal(st.data.has(PENDING_CODE_KEY), false);
});

test('pending code: junk is never stored and junk already there is dropped', () => {
  const st = fakeStorage();
  assert.equal(storePendingCode(st, 'AB'), null);
  assert.equal(storePendingCode(st, null), null);
  assert.equal(storePendingCode(st, undefined), null);
  assert.equal(st.data.size, 0);
  const dirty = fakeStorage({ [PENDING_CODE_KEY]: '!!' });
  assert.equal(takePendingCode(dirty), null);
  assert.equal(dirty.data.has(PENDING_CODE_KEY), false, 'the junk is cleared on take');
});

test('pending helpers survive a missing or blocked storage', () => {
  assert.equal(storePendingCode(null, 'OFEK-H2-27'), 'OFEK-H2-27', 'the code is still returned for this screen');
  assert.equal(peekPendingCode(null), null);
  assert.equal(takePendingCode(null), null);
  assert.equal(takeEntryHint(null), null);
  assert.doesNotThrow(() => storeEntryHint(null, 'pin'));
  const blocked = throwingStorage();
  assert.equal(storePendingCode(blocked, 'OFEK-H2-27'), 'OFEK-H2-27');
  assert.equal(peekPendingCode(blocked), null);
  assert.equal(takePendingCode(blocked), null);
  assert.doesNotThrow(() => storeEntryHint(blocked, 'pin'));
  assert.equal(takeEntryHint(blocked), null);
});

test('entry hint: pin round-trips once, unknown values are dropped', () => {
  const st = fakeStorage();
  assert.equal(ENTRY_HINT_KEY, 'ws.entry');
  storeEntryHint(st, 'pin');
  assert.equal(st.data.get(ENTRY_HINT_KEY), 'pin');
  assert.equal(takeEntryHint(st), 'pin');
  assert.equal(takeEntryHint(st), null);
  const odd = fakeStorage({ [ENTRY_HINT_KEY]: 'email' });
  assert.equal(takeEntryHint(odd), null);
  assert.equal(odd.data.has(ENTRY_HINT_KEY), false);
});
