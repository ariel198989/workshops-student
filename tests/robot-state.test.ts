import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HOLD_MS, initialRobot, robotReducer, type RobotState } from '../lib/robot/state.ts';
import { SPEAK_GAP_MS, type Mood } from '../lib/robot/mood.ts';
import { loadVoicePref, saveVoicePref, VOICE_KEY, type StorageLike } from '../lib/robot/voicePref.ts';

const tick = (s: RobotState, mood: Mood, now: number, className?: string) =>
  robotReducer(s, { type: 'mood', mood, ctx: { className }, now });

test('starts idle with a line and speaks on the first real change', () => {
  const s0 = initialRobot();
  assert.equal(s0.mood, 'idle');
  assert.ok(s0.line.length > 0);
  const s1 = tick(s0, 'sure', 1000, 'כוס');
  assert.equal(s1.mood, 'sure');
  assert.equal(s1.className, 'כוס');
  assert.match(s1.line, /כוס/);
  assert.equal(s1.speakId, 1);
  assert.equal(s1.lastSpokenAt, 1000);
});

test('the same prediction every 350ms is a no-op (same reference)', () => {
  let s = tick(initialRobot(), 'sure', 1000, 'כוס');
  const again = tick(s, 'sure', 1350, 'כוס');
  assert.equal(again, s);
  s = tick(s, 'lost', 1700);
  s = tick(s, 'lost', 2050);
  assert.equal(s.className, null, 'lost never names a class');
});

test('a new class under "sure" updates the bubble but speech waits for the 4s gap', () => {
  const s1 = tick(initialRobot(), 'sure', 1000, 'כוס');
  const s2 = tick(s1, 'sure', 2000, 'נעל');
  assert.match(s2.line, /נעל/);
  assert.equal(s2.speakId, 1, 'too soon to speak again');
  const s3 = tick(s2, 'sure', 1000 + SPEAK_GAP_MS, 'ספר');
  assert.equal(s3.speakId, 2);
});

test('events hold their face, then the live mood comes back', () => {
  let s = tick(initialRobot(), 'sure', 1000, 'כוס');
  s = robotReducer(s, { type: 'event', event: 'wrong', now: 2000 });
  assert.equal(s.mood, 'oops');
  assert.match(s.line, /טעיתי|לומד/);
  // live predictions during the hold only move the baseline
  const held = tick(s, 'unsure', 2500, 'נעל');
  assert.equal(held.mood, 'oops');
  assert.equal(held.baseline, 'unsure');
  assert.equal(held.baselineClass, 'נעל');
  const stillHeld = robotReducer(held, { type: 'release', now: 2000 + HOLD_MS - 1 });
  assert.equal(stillHeld, held);
  const released = robotReducer(held, { type: 'release', now: 2000 + HOLD_MS });
  assert.equal(released.mood, 'unsure');
  assert.equal(released.className, 'נעל');
  assert.match(released.line, /נעל/);
});

test('repeated presses are time-gated, not mood-gated', () => {
  let s = robotReducer(initialRobot(), { type: 'event', event: 'right', now: 1000 });
  assert.equal(s.speakId, 1);
  s = robotReducer(s, { type: 'event', event: 'right', now: 2000 });
  assert.equal(s.speakId, 1, 'within the gap');
  s = robotReducer(s, { type: 'event', event: 'right', now: 1000 + SPEAK_GAP_MS });
  assert.equal(s.speakId, 2, 'same event again after 4s speaks');
  assert.equal(s.mood, 'happy');
});

test('shot lines rotate so twelve shutter presses do not repeat one sentence', () => {
  let s = initialRobot();
  const seen = new Set<string>();
  for (let i = 0; i < 6; i++) {
    s = robotReducer(s, { type: 'event', event: 'shot', ctx: { count: i + 1 }, now: 1000 + i * 100 });
    seen.add(s.line);
  }
  assert.ok(seen.size >= 2);
  assert.equal(s.mood, 'curious');
});

test('reset puts the robot to sleep and learned names the class and count', () => {
  const slept = robotReducer(initialRobot(), { type: 'event', event: 'reset', now: 1 });
  assert.equal(slept.mood, 'sleep');
  assert.equal(slept.line, 'שכחתי הכול. מתחילים מחדש');
  const learned = robotReducer(initialRobot(), { type: 'event', event: 'learned', ctx: { count: 12, className: 'כוס' }, now: 1 });
  assert.equal(learned.mood, 'happy');
  assert.equal(learned.line, 'יש! למדתי 12 תמונות של כוס');
});

function memoryStorage(): StorageLike & { map: Map<string, string> } {
  const map = new Map<string, string>();
  return { map, getItem: (k) => map.get(k) ?? null, setItem: (k, v) => { map.set(k, v); } };
}

test('voice preference is off by default, persists, and swallows storage failures', () => {
  const st = memoryStorage();
  assert.equal(loadVoicePref(st), false);
  saveVoicePref(true, st);
  assert.equal(st.map.get(VOICE_KEY), '1');
  assert.equal(loadVoicePref(st), true);
  saveVoicePref(false, st);
  assert.equal(loadVoicePref(st), false);
  const broken: StorageLike = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('full'); } };
  assert.doesNotThrow(() => saveVoicePref(true, broken));
  assert.equal(loadVoicePref(broken), false);
  assert.equal(loadVoicePref(null), false);
});
