import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  barLevel, canClassify, capPerClass, checkNewClass, confidenceWord, defaultRules, dotStates, emptyTally,
  initialLight, kFor, LIGHT_HOLD_MS, lightStep, recordResult, ruleTarget, tallyCorrect, tallyFull, tallyLabel, toggleRule,
} from '../lib/pocket/score.ts';
import {
  decodeTrainer, encodeTrainer, exampleCount, loadTrainer, roundVector, saveTrainer, clearTrainer, storageKey,
  type SavedTrainer, type StorageLike,
} from '../lib/pocket/store.ts';

test('bar colour and word follow the two thresholds', () => {
  assert.equal(barLevel(0.95), 'green');
  assert.equal(barLevel(0.8), 'green');
  assert.equal(barLevel(0.79), 'yellow');
  assert.equal(barLevel(0.5), 'yellow');
  assert.equal(barLevel(0.49), 'red');
  assert.equal(confidenceWord(0.9), 'בטוח');
  assert.equal(confidenceWord(0.6), 'לא בטוח');
  assert.equal(confidenceWord(0.1), 'לא מכיר');
});

test('k comes from the smallest populated class, clamped to 2..8', () => {
  assert.equal(kFor({}), 2);
  assert.equal(kFor({ a: 10, b: 0 }), 8);
  assert.equal(kFor({ a: 1, b: 10 }), 2);
  assert.equal(kFor({ a: 3, b: 10, c: 5 }), 6);
  assert.equal(kFor({ a: 40, b: 60 }), 8);
});

test('classification needs two populated classes', () => {
  assert.equal(canClassify({ a: 5 }), false);
  assert.equal(canClassify({ a: 5, b: 0 }), false);
  assert.equal(canClassify({ a: 5, b: 1 }), true);
});

test('tally counts to ten and never shows a percentage', () => {
  let t = emptyTally();
  t = recordResult(t, true);
  t = recordResult(t, false);
  t = recordResult(t, true);
  assert.equal(tallyCorrect(t), 2);
  assert.equal(tallyLabel(t), '2 מתוך 10');
  assert.equal(tallyFull(t), false);
  for (let i = 0; i < 12; i++) t = recordResult(t, true);
  assert.equal(t.cells.length, 10);
  assert.equal(tallyFull(t), true);
  assert.equal(tallyLabel(t), '9 מתוך 10');
  assert.doesNotMatch(tallyLabel(t), /%/);
});

test('rules default to first green, rest red, and toggle', () => {
  const rules = defaultRules(['כוס', 'נעל']);
  assert.deepEqual(rules, [{ className: 'כוס', colour: 'green' }, { className: 'נעל', colour: 'red' }]);
  const flipped = toggleRule(rules, 'נעל');
  assert.equal(flipped[1].colour, 'green');
  assert.equal(rules[1].colour, 'red', 'toggle must not mutate');
  assert.equal(ruleTarget(rules, 'כוס', 0.9), 'green');
  assert.equal(ruleTarget(rules, 'נעל', 0.6), 'red');
  assert.equal(ruleTarget(rules, 'נעל', 0.3), null, 'unknown asks nothing');
  assert.equal(ruleTarget(rules, null, 0.9), null);
  assert.equal(ruleTarget(rules, 'ספר', 0.9), null);
});

test('the light waits 1.5s on a stable target and ignores wobble', () => {
  let s = initialLight();
  s = lightStep(s, 'green', 1000);
  assert.equal(s.shown, 'off');
  s = lightStep(s, 'green', 1000 + LIGHT_HOLD_MS - 1);
  assert.equal(s.shown, 'off');
  s = lightStep(s, 'green', 1000 + LIGHT_HOLD_MS);
  assert.equal(s.shown, 'green');
  // red for 1s then back to green: no change
  s = lightStep(s, 'red', 5000);
  s = lightStep(s, 'red', 5900);
  s = lightStep(s, 'green', 6000);
  s = lightStep(s, 'red', 6100);
  s = lightStep(s, 'red', 7500);
  assert.equal(s.shown, 'green', 'the red run restarted at 6100');
  s = lightStep(s, 'red', 7600);
  assert.equal(s.shown, 'red');
  // unsure frames keep the light as it is
  s = lightStep(s, null, 9000);
  assert.equal(s.shown, 'red');
});

test('dots and class-name checks', () => {
  assert.deepEqual(dotStates(3, 5), [true, true, true, false, false]);
  assert.equal(dotStates(14).filter(Boolean).length, 10);
  assert.deepEqual(checkNewClass(' ספר ', ['כוס']), { ok: true, name: 'ספר' });
  assert.equal(checkNewClass('כוס', ['כוס']).ok, false);
  assert.equal(checkNewClass('', []).ok, false);
  assert.equal(checkNewClass('ד', ['א', 'ב', 'ג']).ok, false);
  assert.equal(checkNewClass('"x"', []).ok, false);
});

test('gallery cap keeps newest N per wanted class', () => {
  const rows = [
    { class_name: 'כוס', id: 1 }, { class_name: 'נעל', id: 2 }, { class_name: 'כוס', id: 3 },
    { class_name: 'ספר', id: 4 }, { class_name: 'כוס', id: 5 },
  ];
  const out = capPerClass(rows, ['כוס', 'נעל'], 2);
  assert.deepEqual(out.map((r) => r.id), [1, 2, 3]);
});

function memoryStorage(): StorageLike & { map: Map<string, string> } {
  const map = new Map<string, string>();
  return {
    map,
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => { map.set(k, v); },
    removeItem: (k) => { map.delete(k); },
  };
}

test('trainer round-trips through storage keyed by workshop', () => {
  const st = memoryStorage();
  const t: SavedTrainer = {
    classes: ['כוס', 'נעל'],
    dataset: { 'כוס': { data: [1, 2, 3, 4], shape: [2, 2] }, 'נעל': { data: [5, 6], shape: [1, 2] } },
    savedAt: 7,
  };
  assert.equal(saveTrainer('w1', t, st), true);
  assert.equal(storageKey('w1'), 'ws_pocket_v1:w1');
  assert.equal(storageKey(null), 'ws_pocket_v1:free');
  assert.deepEqual(loadTrainer('w1', st), t);
  assert.equal(loadTrainer('w2', st), null);
  assert.equal(exampleCount(t), 3);
  clearTrainer('w1', st);
  assert.equal(loadTrainer('w1', st), null);
});

test('decode rejects corrupt or mismatched entries and drops unknown labels', () => {
  assert.equal(decodeTrainer(null), null);
  assert.equal(decodeTrainer('{not json'), null);
  assert.equal(decodeTrainer('[]'), null);
  const bad = encodeTrainer({
    classes: ['a'],
    dataset: { a: { data: [1, 2, 3], shape: [2, 2] }, zzz: { data: [1, 2], shape: [1, 2] } },
    savedAt: 0,
  });
  const d = decodeTrainer(bad);
  assert.deepEqual(d, { classes: ['a'], dataset: {}, savedAt: 0 });
});

test('storage failures are swallowed', () => {
  const broken: StorageLike = {
    getItem: () => { throw new Error('blocked'); },
    setItem: () => { throw new Error('full'); },
    removeItem: () => { throw new Error('blocked'); },
  };
  assert.equal(saveTrainer('w', { classes: [], dataset: {}, savedAt: 0 }, broken), false);
  assert.equal(loadTrainer('w', broken), null);
  assert.doesNotThrow(() => clearTrainer('w', broken));
  assert.equal(saveTrainer('w', { classes: [], dataset: {}, savedAt: 0 }, null), false);
});

test('vectors are rounded to four decimals', () => {
  assert.deepEqual(roundVector(new Float32Array([0.123456, -1.00012])), [0.1235, -1.0001]);
  assert.deepEqual(roundVector([2, 0.00004]), [2, 0]);
});
