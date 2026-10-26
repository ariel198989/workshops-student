import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatMetric, barColor, tenths, scoreOf, showsNumbers } from '../lib/student/metric.ts';

const stats = [
  { name: 'כוס', ap50: 0.92, boxes: 120 },
  { name: 'מפתח', ap50: 0.31, boxes: 15 },
  { name: 'עט', ap50: null, boxes: null },
];
const withPr = [
  { name: 'כוס', ap50: 0.9, boxes: 100, precision: 0.8, recall: 0.6, tp: 12, fp: 3, fn: 8 },
  { name: 'מפתח', ap50: 0.7, boxes: 90, precision: 0.6, recall: 0.4 },
];

const noPercent = (s: string) => assert.doesNotMatch(s, /%/, `percent sign in "${s}"`);

test('tenths / scoreOf / barColor', () => {
  assert.equal(tenths(0.74), 7);
  assert.equal(tenths(74), 7); // already in percent
  assert.equal(tenths(null), null);
  assert.equal(scoreOf(0.02), 1); // a model never scores 0
  assert.equal(scoreOf(1), 10);
  assert.equal(barColor(8), 'green');
  assert.equal(barColor(5), 'yellow');
  assert.equal(barColor(4), 'red');
});

test('yes_no: כן / לא per class, no numbers anywhere', () => {
  const v = formatMetric('yes_no', { accuracy: 0.8, class_stats: stats });
  assert.equal(v.headline, 'המודל מזהה? כן');
  assert.equal(v.bar, undefined);
  assert.deepEqual(v.classes.map((c) => [c.name, c.text, c.fill]), [['כוס', 'כן', null], ['מפתח', 'לא', null], ['עט', 'עוד לא נמדד', null]]);
  for (const c of v.classes) assert.doesNotMatch(c.text, /\d/);
  assert.equal(v.classes[1].weak, true);
  assert.equal(formatMetric('yes_no', { accuracy: 0.3, class_stats: null }).headline, 'המודל מזהה? לא');
});

test('x_of_10: "X מתוך 10" with the colour bar and never a percent sign', () => {
  const v = formatMetric('x_of_10', { accuracy: 0.83, class_stats: stats });
  assert.equal(v.headline, '8 מתוך 10');
  assert.deepEqual(v.bar, { fill: 0.8, color: 'green' });
  noPercent(v.headline);
  v.lines.forEach(noPercent);
  v.classes.forEach((c) => noPercent(c.text));
  assert.equal(v.classes[0].text, '9 מתוך 10');
  assert.equal(v.classes[2].text, 'עוד לא נמדד');
  assert.deepEqual(formatMetric('x_of_10', { accuracy: 0.5, class_stats: [] }).bar, { fill: 0.5, color: 'yellow' });
  assert.deepEqual(formatMetric('x_of_10', { accuracy: 0.2, class_stats: [] }).bar, { fill: 0.2, color: 'red' });
});

test('score_1_10: ציון N, four-box words only when counts exist', () => {
  const v = formatMetric('score_1_10', { accuracy: 0.66, class_stats: withPr });
  assert.equal(v.headline, 'ציון 7');
  assert.equal(v.classes[0].text, 'ציון 9');
  assert.equal(v.classes[0].detail, 'צדק ומצא 12 · פספס 8 · התריע סתם 3');
  assert.equal(v.classes[1].detail, undefined); // precision/recall but no counts → omitted
  const plain = formatMetric('score_1_10', { accuracy: 0.66, class_stats: stats });
  for (const c of plain.classes) assert.equal(c.detail, undefined);
  plain.classes.forEach((c) => noPercent(c.text));
});

test('model_score: ציון המודל N plus precision / recall spelled in words as X מתוך 10', () => {
  const v = formatMetric('model_score', { accuracy: 0.8, class_stats: withPr });
  assert.equal(v.headline, 'ציון המודל 8');
  assert.deepEqual(v.lines, ['מתוך מה שסימן, כמה היה נכון: 7 מתוך 10', 'מתוך מה שהיה, כמה מצא: 5 מתוך 10']);
  v.lines.forEach(noPercent);
  // today's class_stats carry no precision/recall → the two lines are simply absent
  assert.deepEqual(formatMetric('model_score', { accuracy: 0.8, class_stats: stats }).lines, []);
});

test('map_pr: full numbers with a percent sign and a per-class table when precision/recall exist', () => {
  const v = formatMetric('map_pr', { accuracy: 0.874, class_stats: withPr });
  assert.equal(v.headline, 'mAP50 87%');
  assert.match(v.lines[0], /^precision 70%/);
  assert.match(v.lines[1], /^recall 50%/);
  assert.equal(v.classes[0].text, '90%');
  assert.deepEqual(v.table?.columns, ['אובייקט', 'AP50', 'precision', 'recall', 'תיבות']);
  assert.deepEqual(v.table?.rows[1], { name: 'מפתח', cells: ['70%', '60%', '40%', '90'] });
  assert.equal(formatMetric('map_pr', { accuracy: 0.874, class_stats: stats }).table, undefined);
});

test('unknown class_stats shapes degrade to an empty class list; null accuracy says not measured', () => {
  for (const mode of ['yes_no', 'x_of_10', 'score_1_10', 'model_score', 'map_pr'] as const) {
    const v = formatMetric(mode, { accuracy: null, class_stats: { nope: 1 } });
    assert.deepEqual(v.classes, []);
    assert.match(v.headline, /עוד לא נמדד/);
    assert.equal(v.bar, undefined);
  }
  assert.equal(showsNumbers('yes_no'), false);
  assert.equal(showsNumbers('x_of_10'), true);
});
