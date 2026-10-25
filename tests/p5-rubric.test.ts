import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';

const HOOK = `export async function resolve(spec, ctx, next) {
  try { return await next(spec, ctx); }
  catch (e) {
    if (e && e.code === 'ERR_MODULE_NOT_FOUND' && /^\\.\\.?\\//.test(spec)) return next(spec + '.ts', ctx);
    throw e;
  }
}`;
register('data:text/javascript,' + encodeURIComponent(HOOK), import.meta.url);

let R: typeof import('../components/ws/p5/rubric.ts');
let D: typeof import('../lib/ws/deliverables.ts');
before(async () => {
  R = await import('../components/ws/p5/rubric.ts');
  D = await import('../lib/ws/deliverables.ts');
});

const allAt = (n: number) => Object.fromEntries(D.DEMO_DAY_RUBRIC.criteria.map((c) => [c.id, n]));

test('rubric weights sum to 100 with 6 criteria and 4 levels', () => {
  assert.equal(D.DEMO_DAY_RUBRIC.criteria.length, 6);
  assert.equal(D.DEMO_DAY_RUBRIC.criteria.reduce((s, c) => s + c.weight, 0), 100);
  assert.equal(D.DEMO_DAY_RUBRIC.maxLevel, 4);
});

test('level descriptions exist for every criterion and level', () => {
  for (const c of D.DEMO_DAY_RUBRIC.criteria) {
    for (const level of [1, 2, 3, 4]) assert.ok(R.levelText(c.id, level).length > 0, `${c.id}/${level}`);
  }
  assert.equal(R.levelText('missing', 1), '');
});

test('rubricTotal: all fours is 100, all ones is 25, empty is 0', () => {
  assert.equal(R.rubricTotal(allAt(4)), 100);
  assert.equal(R.rubricTotal(allAt(1)), 25);
  assert.equal(R.rubricTotal({}), 0);
});

test('rubricTotal ignores unknown criteria and clamps levels', () => {
  assert.equal(R.rubricTotal({ computer_vision: 9, bogus: 4 }), 25);
});

test('isComplete needs every criterion scored', () => {
  assert.equal(R.isComplete({ computer_vision: 3 }), false);
  assert.equal(R.isComplete(allAt(3)), true);
});

test('readRubricScores only keeps valid integer levels of known criteria', () => {
  const scores = R.readRubricScores({ rubric: { scores: { computer_vision: 3, teamwork: 7, creativity: 'x', other: 2 } } });
  assert.deepEqual(scores, { computer_vision: 3 });
  assert.deepEqual(R.readRubricScores({}), {});
  assert.deepEqual(R.readRubricScores({ rubric: 'bad' }), {});
});

test('buildRubricExtras merges immutably and keeps other extras', () => {
  const prev = { keep: 1 };
  const out = R.buildRubricExtras(prev, { computer_vision: 4 });
  assert.deepEqual(prev, { keep: 1 });
  assert.equal(out.keep, 1);
  assert.deepEqual(R.readRubricScores(out), { computer_vision: 4 });
});

test('scoreBand follows the curriculum bands', () => {
  assert.equal(R.scoreBand(90), 'בהצטיינות');
  assert.equal(R.scoreBand(85), 'בהצטיינות');
  assert.equal(R.scoreBand(60), 'עמידה בציפיות');
  assert.equal(R.scoreBand(59.9), 'בדרך (המשך חניכה)');
});
