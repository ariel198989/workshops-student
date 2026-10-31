import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEVICE_EMAIL_DOMAIN, isDeviceEmail, isPlaceholderName, PLACEHOLDER_NAME, prefillName, shownName,
} from '../lib/student/device-account.ts';
import { NUMBER_SUB, NUMBER_TITLE, STUDENT_ENTRY_FIRST, STUDENT_ENTRY_LINKS, STUDENT_ENTRY_ORDER } from '../lib/student/entry.ts';
import { firstName, validateJoinName } from '../lib/student/labels.ts';

// ── the signed-out student card, as AuthCard renders it ──

test('the number keypad comes first; QR, code + PIN and email follow as links, in that order', () => {
  assert.equal(STUDENT_ENTRY_FIRST, 'number');
  assert.deepEqual([...STUDENT_ENTRY_ORDER], ['number', 'qr', 'pin', 'email']);
  assert.deepEqual(STUDENT_ENTRY_LINKS.map((l) => l.id), ['qr', 'pin', 'email']);
  assert.equal(STUDENT_ENTRY_ORDER[0], STUDENT_ENTRY_FIRST);
  assert.equal(STUDENT_ENTRY_LINKS.map((l) => String(l.id)).includes('number'), false, 'the keypad is the card, not a link');
});

test('link copy: the QR item is a sentence, the other two open a screen', () => {
  const byId = Object.fromEntries(STUDENT_ENTRY_LINKS.map((l) => [l.id, l]));
  assert.equal(byId.qr.label, 'יש לי QR מהמדריך');
  assert.ok(byId.qr.explainer && byId.qr.explainer.length > 20, 'the QR link unfolds an explanation');
  assert.equal(byId.pin.label, 'כניסה עם קוד ו-PIN');
  assert.equal(byId.pin.explainer, undefined);
  assert.equal(byId.email.label, 'יש לי חשבון עם אימייל');
  assert.equal(byId.email.explainer, undefined);
});

test('number screen copy, no dashes', () => {
  assert.equal(NUMBER_TITLE, 'מה מספר הסדנה?');
  assert.equal(NUMBER_SUB, 'המדריך אומר לכם 4 ספרות');
  for (const s of [NUMBER_TITLE, NUMBER_SUB, ...STUDENT_ENTRY_LINKS.flatMap((l) => [l.label, l.explainer ?? ''])]) {
    assert.doesNotMatch(s, /[—–]/, 'no dashes in Hebrew copy');
  }
});

// ── device accounts: the placeholder name is never shown or prefilled ──

test('isDeviceEmail / isPlaceholderName', () => {
  assert.equal(DEVICE_EMAIL_DOMAIN, '@devices.corewise.local');
  assert.equal(PLACEHOLDER_NAME, 'תלמיד/ה');
  assert.equal(isDeviceEmail('dev-abc123@devices.corewise.local'), true);
  assert.equal(isDeviceEmail(' DEV-ABC@DEVICES.COREWISE.LOCAL '), true, 'case and spaces do not matter');
  assert.equal(isDeviceEmail('g3@device.local'), false, 'the group tablet accounts are not this kind');
  assert.equal(isDeviceEmail('kid@gmail.com'), false);
  assert.equal(isDeviceEmail(''), false);
  assert.equal(isDeviceEmail(null), false);
  assert.equal(isDeviceEmail(undefined), false);
  assert.equal(isPlaceholderName('תלמיד/ה'), true);
  assert.equal(isPlaceholderName('  תלמיד/ה '), true);
  assert.equal(isPlaceholderName('נועה'), false);
  assert.equal(isPlaceholderName(''), false);
  assert.equal(isPlaceholderName(null), false);
});

test('prefillName: a real name on a real account only', () => {
  assert.equal(prefillName('נועה כהן', 'noa@gmail.com'), 'נועה כהן');
  assert.equal(prefillName('תלמיד/ה', 'noa@gmail.com'), '', 'the placeholder is never prefilled');
  assert.equal(prefillName('נועה', 'dev-1@devices.corewise.local'), '', 'a device account starts empty whatever it carries');
  assert.equal(prefillName(undefined, 'noa@gmail.com'), '');
  assert.equal(prefillName(42, 'noa@gmail.com'), '');
});

test('shownName drops the placeholder, so the greeting and the team list use the typed name', () => {
  assert.equal(shownName('נועה כהן'), 'נועה כהן');
  assert.equal(shownName('תלמיד/ה'), '');
  assert.equal(shownName('  '), '');
  assert.equal(shownName(null), '');
  assert.equal(firstName(shownName('תלמיד/ה')), '', 'the home greeting falls back to a plain שלום');
  assert.equal(firstName(shownName('נועה כהן')), 'נועה');
});

// ── the name step for children ──

test('validateJoinName keeps the 2-char minimum and speaks to the child in the singular', () => {
  assert.equal(validateJoinName('נו', true), null);
  assert.equal(validateJoinName(' נ ', true), 'כתבו את השם שלכם, לפחות 2 אותיות');
  assert.equal(validateJoinName('', true), 'כתבו את השם שלכם, לפחות 2 אותיות');
  assert.equal(validateJoinName('נ'), 'כתבו את השם המלא שלכם', 'account holders keep the old copy');
  assert.equal(validateJoinName('נועה כהן'), null);
});
