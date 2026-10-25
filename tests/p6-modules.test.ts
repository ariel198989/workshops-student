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

let F: typeof import('../components/ws/p6/module-form.ts');
let L: typeof import('../components/ws/p6/labels.ts');
let Q: typeof import('../components/ws/p6/filters.ts');
let TY: typeof import('../lib/ws/types.ts');

before(async () => {
  F = await import('../components/ws/p6/module-form.ts');
  L = await import('../components/ws/p6/labels.ts');
  Q = await import('../components/ws/p6/filters.ts');
  TY = await import('../lib/ws/types.ts');
});

const mod = (over: Record<string, unknown> = {}) => ({
  id: 'm1', slug: 'core-s1', title: 'מפגש 1', summary: null, module_type: 'practice', pipeline_stage: 'intro',
  duration_minutes: 120, objectives: [], exercises: [], materials: [], facilitator_notes: null,
  tags: ['audience:school', 'type:session'], requires_app: false, version: 3, parent_module_id: null,
  is_archived: false, created_by: null, created_at: '', updated_at: '', ...over,
}) as import('../lib/ws/types.ts').WsModule;

// ── labels ────────────────────────────────────────────────────────────
test('every tool hook, module type and stage has a Hebrew label', () => {
  for (const h of L.TOOL_HOOKS) assert.ok(L.TOOL_HOOK_LABELS[h].length > 0, h);
  for (const t of ['theory', 'practice', 'demo', 'mixed'] as const) assert.ok(L.MODULE_TYPE_LABELS[t], t);
  for (const s of L.PIPELINE_STAGES) assert.ok(L.STAGE_LABELS[s], s);
  assert.deepEqual([...L.TOOL_HOOKS].sort(),
    ['cloud_train', 'live_cam', 'map', 'none', 'phone_tagger', 'pocket_trainer', 'presentation', 'series_capture']);
});

test('labels fall back to the raw value for unknown keys', () => {
  assert.equal(L.toolHookLabel('weird'), 'weird');
  assert.equal(L.toolHookLabel('live_cam'), L.TOOL_HOOK_LABELS.live_cam);
  assert.equal(L.stageLabel(null), '');
  assert.equal(L.stageLabel('train'), L.STAGE_LABELS.train);
});

test('UI labels never contain em dashes', () => {
  const all = [...Object.values(L.TOOL_HOOK_LABELS), ...Object.values(L.STAGE_LABELS),
    ...Object.values(L.MODULE_TYPE_LABELS), ...Object.values(L.FORMAT_LABELS), ...Object.values(L.EXERCISE_KIND_LABELS)];
  for (const s of all) assert.ok(!s.includes('—'), s);
});

test('all workshop formats are labelled', () => {
  for (const f of TY.WORKSHOP_FORMATS) assert.ok(L.FORMAT_LABELS[f], f);
});

// ── filters ───────────────────────────────────────────────────────────
const LIB = [
  mod({ id: '1', title: 'איך מכונה רואה', pipeline_stage: 'intro', module_type: 'demo', tags: ['audience:school'], requires_app: true }),
  mod({ id: '2', title: 'אימון מודל', pipeline_stage: 'train', module_type: 'practice', tags: ['audience:adult'], summary: 'ענן' }),
  mod({ id: '3', title: 'ממשל ופרטיות', pipeline_stage: null, module_type: 'theory', tags: ['audience:school', 'audience:adult'] }),
];

test('filterModules with empty filters returns everything', () => {
  assert.equal(Q.filterModules(LIB, Q.EMPTY_FILTERS).length, 3);
});

test('filterModules by stage, type, audience and requires_app', () => {
  assert.deepEqual(Q.filterModules(LIB, { ...Q.EMPTY_FILTERS, stage: 'train' }).map((m) => m.id), ['2']);
  assert.deepEqual(Q.filterModules(LIB, { ...Q.EMPTY_FILTERS, type: 'theory' }).map((m) => m.id), ['3']);
  assert.deepEqual(Q.filterModules(LIB, { ...Q.EMPTY_FILTERS, audience: 'adult' }).map((m) => m.id), ['2', '3']);
  assert.deepEqual(Q.filterModules(LIB, { ...Q.EMPTY_FILTERS, requiresApp: true }).map((m) => m.id), ['1']);
});

test('filterModules search matches title and summary and combines with other filters', () => {
  assert.deepEqual(Q.filterModules(LIB, { ...Q.EMPTY_FILTERS, search: 'ענן' }).map((m) => m.id), ['2']);
  assert.deepEqual(Q.filterModules(LIB, { ...Q.EMPTY_FILTERS, search: ' מכונה ' }).map((m) => m.id), ['1']);
  assert.deepEqual(Q.filterModules(LIB, { ...Q.EMPTY_FILTERS, search: 'מ', audience: 'adult' }).map((m) => m.id), ['2', '3']);
});

test('filterModules does not mutate the input', () => {
  const copy = [...LIB];
  Q.filterModules(LIB, { ...Q.EMPTY_FILTERS, stage: 'train' });
  assert.deepEqual(LIB, copy);
});

// ── module form ───────────────────────────────────────────────────────
test('readExercises fills defaults and keeps unknown fields like questions', () => {
  const [ex] = F.readExercises([{ title: 'שאלון', instructions: '1. א\n2. ב', questions: [{ q: 'ש', options: ['x', 'y'], answer: 1 }], extra: 7 }]);
  assert.equal(ex.kind, 'group');
  assert.equal(ex.tool_hook, 'none');
  assert.equal(ex.extra, 7);
  assert.equal(F.readQuestions(ex.questions).length, 1);
});

test('readExercises survives garbage input', () => {
  assert.deepEqual(F.readExercises([null, 5, 'x'] as unknown as []), []);
  assert.equal(F.readExercises([{}])[0].title, '');
});

test('readQuestions drops malformed entries and clamps the answer index', () => {
  const qs = F.readQuestions([{ q: 'a', options: ['1', '2'], answer: 9 }, { q: 'b' }, 4, { q: 'c', options: ['x'], answer: 0 }]);
  assert.deepEqual(qs.map((q) => q.q), ['a', 'c']);
  assert.equal(qs[0].answer, -1);
  assert.equal(qs[1].answer, 0);
});

test('readMaterials normalizes label and kind', () => {
  assert.deepEqual(F.readMaterials([{ label: 'דף', kind: 'supply' }, { label: 'x' }, { nope: 1 }]), [
    { label: 'דף', kind: 'supply' }, { label: 'x', kind: 'handout' },
  ]);
});

test('draftFromModule and draftToInput round-trip the editable fields', () => {
  const m = mod({ summary: 's', objectives: ['o1'], tags: ['a'], facilitator_notes: 'n', requires_app: true });
  const draft = F.draftFromModule(m);
  const input = F.draftToInput(draft, m.id);
  assert.equal(input.id, 'm1');
  assert.equal(input.title, 'מפגש 1');
  assert.deepEqual(input.objectives, ['o1']);
  assert.equal(input.requires_app, true);
  assert.equal('version' in input, false);
  assert.equal('created_at' in input, false);
});

test('draftToInput trims, drops empty list rows and nulls blank optional text', () => {
  const draft = { ...F.emptyDraft(), title: '  שם  ', summary: '   ', objectives: [' א ', '', '  '], tags: ['x', ' ', 'x'],
    facilitator_notes: '', pipeline_stage: '' };
  const input = F.draftToInput(draft);
  assert.equal(input.title, 'שם');
  assert.equal(input.summary, null);
  assert.deepEqual(input.objectives, ['א']);
  assert.deepEqual(input.tags, ['x']);
  assert.equal(input.facilitator_notes, null);
  assert.equal(input.pipeline_stage, null);
  assert.equal('id' in input, false);
});

test('validateDraft enforces the DB checks in Hebrew', () => {
  const ok = { ...F.emptyDraft(), title: 'שם תקין' };
  assert.equal(F.validateDraft(ok), null);
  assert.match(F.validateDraft({ ...ok, title: 'א' }) ?? '', /כותרת/);
  assert.match(F.validateDraft({ ...ok, title: 'א'.repeat(121) }) ?? '', /כותרת/);
  assert.match(F.validateDraft({ ...ok, duration_minutes: 4 }) ?? '', /משך/);
  assert.match(F.validateDraft({ ...ok, duration_minutes: 721 }) ?? '', /משך/);
  assert.match(F.validateDraft({ ...ok, duration_minutes: Number.NaN }) ?? '', /משך/);
});

test('cloneInput copies content, links the parent and clears identity', () => {
  const m = mod({ summary: 's', objectives: ['o'] });
  const input = F.cloneInput(m);
  assert.equal(input.parent_module_id, 'm1');
  assert.equal(input.title, 'מפגש 1 (עותק)');
  assert.equal(input.slug, null);
  assert.equal('id' in input, false);
  assert.deepEqual(input.objectives, ['o']);
});

test('immutable list helpers', () => {
  const list = ['a', 'b', 'c'];
  assert.deepEqual(F.moveAt(list, 0, 2), ['b', 'c', 'a']);
  assert.deepEqual(F.moveAt(list, 2, 0), ['c', 'a', 'b']);
  assert.deepEqual(F.moveAt(list, 1, 5), list);
  assert.deepEqual(F.removeAt(list, 1), ['a', 'c']);
  assert.deepEqual(F.replaceAt(list, 1, 'z'), ['a', 'z', 'c']);
  assert.deepEqual(list, ['a', 'b', 'c']);
});
