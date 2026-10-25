import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';

// The app uses extensionless relative imports (bundler resolution); plain Node
// needs a hook that retries them with a .ts suffix. Registered before any lib import.
const HOOK = `export async function resolve(spec, ctx, next) {
  try { return await next(spec, ctx); }
  catch (e) {
    if (e && e.code === 'ERR_MODULE_NOT_FOUND' && /^\\.\\.?\\//.test(spec)) return next(spec + '.ts', ctx);
    throw e;
  }
}`;
register('data:text/javascript,' + encodeURIComponent(HOOK), import.meta.url);

let T: typeof import('../lib/ws/types.ts');
let L: typeof import('../lib/ws/labels.ts');
let W: typeof import('../lib/ws/workshops.ts');
let G: typeof import('../lib/ws/groups.ts');
let A: typeof import('../lib/ws/attendance.ts');
let D: typeof import('../lib/ws/deliverables.ts');
let C: typeof import('../lib/ws/certificates.ts');
let S: typeof import('../lib/ws/staff.ts');
let E: typeof import('../lib/ws/events.ts');
let K: typeof import('../lib/ws/curriculum.ts');
let P: typeof import('../lib/ws/participants.ts');

before(async () => {
  T = await import('../lib/ws/types.ts');
  L = await import('../lib/ws/labels.ts');
  W = await import('../lib/ws/workshops.ts');
  G = await import('../lib/ws/groups.ts');
  A = await import('../lib/ws/attendance.ts');
  D = await import('../lib/ws/deliverables.ts');
  C = await import('../lib/ws/certificates.ts');
  S = await import('../lib/ws/staff.ts');
  E = await import('../lib/ws/events.ts');
  K = await import('../lib/ws/curriculum.ts');
  P = await import('../lib/ws/participants.ts');
});

// ── normalizeTargetClasses ────────────────────────────────────────────
test('normalizeTargetClasses trims, drops empties and dedupes case-insensitively', () => {
  assert.deepEqual(W.normalizeTargetClasses(['  בקבוק ', '', 'Cup', 'cup', 'CUP ', '   ']), ['בקבוק', 'Cup']);
});

test('normalizeTargetClasses strips quotes/newlines and caps length at 40', () => {
  assert.deepEqual(W.normalizeTargetClasses(['"פקק"', "it's", 'a\nb']), ['פקק', 'its', 'ab']);
  const long = 'א'.repeat(60);
  assert.equal(W.normalizeTargetClasses([long])[0].length, 40);
});

test('normalizeTargetClasses keeps first-seen order and caps at 20 classes', () => {
  const many = Array.from({ length: 30 }, (_, i) => `c${i}`);
  const out = W.normalizeTargetClasses(many);
  assert.equal(out.length, 20);
  assert.deepEqual(out.slice(0, 3), ['c0', 'c1', 'c2']);
  assert.deepEqual(W.normalizeTargetClasses([]), []);
});

test('normalizeTargetClasses does not mutate its input', () => {
  const input = Object.freeze([' a ', 'A']);
  assert.deepEqual(W.normalizeTargetClasses(input as string[]), ['a']);
});

// ── attendanceRate ────────────────────────────────────────────────────
const mark = (s: string, p: string, status: 'present' | 'late' | 'absent' | 'excused') =>
  ({ session_id: s, participant_id: p, status });

test('attendanceRate counts present and late over done sessions only', () => {
  const marks = [mark('s1', 'p', 'present'), mark('s2', 'p', 'late'), mark('s3', 'p', 'absent'),
    mark('s4', 'p', 'present'), mark('s1', 'other', 'absent')];
  assert.equal(A.attendanceRate(marks, 'p', ['s1', 's2', 's3']), 2 / 3);
  assert.equal(A.attendanceRate(marks, 'p', ['s1']), 1);
});

test('attendanceRate treats unmarked and excused as not attended', () => {
  const marks = [mark('s1', 'p', 'excused')];
  assert.equal(A.attendanceRate(marks, 'p', ['s1', 's2']), 0);
});

test('attendanceRate with no done sessions mirrors the RPC (1) and accepts a Map', () => {
  assert.equal(A.attendanceRate([], 'p', []), 1);
  const map = A.attendanceMap([mark('s1', 'p', 'present')]);
  assert.equal(A.attendanceRate(map, 'p', ['s1', 's2']), 0.5);
});

// ── scoreRubric ───────────────────────────────────────────────────────
test('demo day rubric weights sum to 100 across 6 criteria', () => {
  const total = D.DEMO_DAY_RUBRIC.criteria.reduce((s, c) => s + c.weight, 0);
  assert.equal(total, 100);
  assert.equal(D.DEMO_DAY_RUBRIC.criteria.length, 6);
});

const allAt = (level: number) =>
  Object.fromEntries(D.DEMO_DAY_RUBRIC.criteria.map((c) => [c.id, level]));

test('scoreRubric: all level 4 is exactly 100, all level 1 is 25', () => {
  assert.equal(D.scoreRubric(allAt(4), D.DEMO_DAY_RUBRIC), 100);
  assert.equal(D.scoreRubric(allAt(1), D.DEMO_DAY_RUBRIC), 25);
});

test('scoreRubric: missing criteria score 0 and out-of-range levels are clamped', () => {
  assert.equal(D.scoreRubric({}, D.DEMO_DAY_RUBRIC), 0);
  assert.equal(D.scoreRubric(allAt(9), D.DEMO_DAY_RUBRIC), 100);
  assert.equal(D.scoreRubric(allAt(-3), D.DEMO_DAY_RUBRIC), 0);
  const first = D.DEMO_DAY_RUBRIC.criteria[0];
  assert.equal(D.scoreRubric({ [first.id]: 4 }, D.DEMO_DAY_RUBRIC), first.weight);
});

// ── teamNames ─────────────────────────────────────────────────────────
test('teamNames returns the team and its personal variant', () => {
  assert.deepEqual(G.teamNames('אופק · קבוצה 1'), ['אופק · קבוצה 1', 'אישי · אופק · קבוצה 1']);
});

// ── renderCertificateHtml ─────────────────────────────────────────────
const data = { student: 'דנה לוי', workshop: 'ראייה ממוחשבת', date: '18.10.2026', org: 'בית ספר אופק' };

test('renderCertificateHtml substitutes all four variables, no {{ left, in every variant', () => {
  for (const v of C.CERTIFICATE_VARIANTS) {
    const html = C.renderCertificateHtml(data, v);
    assert.ok(!html.includes('{{'), `${v} left a placeholder`);
    assert.ok(!html.includes('}}'), `${v} left a placeholder`);
    for (const value of Object.values(data)) assert.ok(html.includes(value), `${v} missing ${value}`);
    assert.ok(html.includes('dir="rtl"'));
  }
});

test('renderCertificateHtml uses the variant title', () => {
  assert.ok(C.renderCertificateHtml(data, 'standard').includes('תעודת סיום'));
  assert.ok(C.renderCertificateHtml(data, 'distinction').includes('תעודת הצטיינות'));
  assert.ok(C.renderCertificateHtml(data, 'corporate').includes('אישור השתתפות'));
});

test('renderCertificateHtml escapes HTML and cannot re-inject placeholders', () => {
  const html = C.renderCertificateHtml(
    { ...data, student: '<script>alert(1)</script>', org: '{{student}}' }, 'standard');
  assert.ok(!html.includes('<script>'));
  assert.ok(!html.includes('{{'));
});

test('renderCertificateHtml strips outer quotes of the workshop name', () => {
  const html = C.renderCertificateHtml({ ...data, workshop: '״ראייה ממוחשבת״' }, 'standard');
  assert.ok(!html.includes('״״'));
});

// ── pillTone / labels ─────────────────────────────────────────────────
const UNIONS = (): Record<string, readonly string[]> => ({
  workshop: T.WORKSHOP_STATUSES, session: T.SESSION_STATUSES, group: T.GROUP_STATUSES,
  deliverable: T.DELIVERABLE_STATUSES, certificate: T.CERTIFICATE_STATUSES, org: T.ORG_STATUSES,
  module: T.MODULE_RUN_STATUSES, attendance: T.ATTENDANCE_STATUSES,
  participant: T.PARTICIPANT_STATUSES, problem: T.PROBLEM_STATUSES,
});

test('pillTone and labelOf cover every value of every status union', () => {
  const unions = UNIONS();
  assert.deepEqual(Object.keys(unions).sort(), [...L.PILL_KINDS].sort());
  for (const [kind, values] of Object.entries(unions)) {
    for (const value of values) {
      const tone = L.pillTone(kind as never, value);
      assert.ok(L.PILL_TONES.includes(tone), `${kind}/${value} tone ${tone}`);
      assert.notEqual(L.labelOf(kind as never, value), value, `${kind}/${value} has no Hebrew label`);
      assert.match(L.labelOf(kind as never, value), /[֐-׿]/);
    }
  }
});

test('pillTone maps lifecycle semantics and falls back to gray for unknown values', () => {
  assert.equal(L.pillTone('workshop', 'live'), 'green');
  assert.equal(L.pillTone('workshop', 'cancelled'), 'red');
  assert.equal(L.pillTone('certificate', 'revoked'), 'red');
  assert.equal(L.pillTone('session', 'postponed'), 'amber');
  assert.equal(L.pillTone('workshop', 'nonsense'), 'gray');
  assert.equal(L.labelOf('workshop', 'nonsense'), 'nonsense');
});

// ── staff helpers ─────────────────────────────────────────────────────
const who = (role: 'owner' | 'admin' | 'instructor' | 'guest' | null, workshops: { workshop_id: string; role: 'lead' | 'instructor' | 'assistant' | 'observer' }[] = []) =>
  ({ user_id: 'u', staff: role ? { role, full_name: 'x' } : null, workshops, participations: [] });

test('isAdmin / isCoreStaff follow the staff role', () => {
  assert.equal(S.isAdmin(who('owner')), true);
  assert.equal(S.isAdmin(who('admin')), true);
  assert.equal(S.isAdmin(who('instructor')), false);
  assert.equal(S.isCoreStaff(who('instructor')), true);
  assert.equal(S.isCoreStaff(who('guest')), false);
  assert.equal(S.isAdmin(null), false);
  assert.equal(S.isCoreStaff(who(null)), false);
});

test('canEdit allows admins and lead/instructor/assistant; canView adds observers', () => {
  const w = who('instructor', [{ workshop_id: 'a', role: 'lead' }, { workshop_id: 'b', role: 'observer' }]);
  assert.equal(S.canEdit(w, 'a'), true);
  assert.equal(S.canEdit(w, 'b'), false);
  assert.equal(S.canEdit(w, 'c'), false);
  assert.equal(S.canView(w, 'b'), true);
  assert.equal(S.canView(w, 'c'), false);
  assert.equal(S.canEdit(who('admin'), 'zzz'), true);
  assert.equal(S.canView(who('admin'), 'zzz'), true);
  assert.equal(S.canEdit(null, 'a'), false);
  assert.equal(S.canEdit(who(null, [{ workshop_id: 'a', role: 'lead' }]), 'a'), false);
});

// ── eventLabel ────────────────────────────────────────────────────────
const evt = (action: string, payload: Record<string, unknown> = {}) =>
  ({ id: 1, workshop_id: 'w', actor: null, action, entity: null, entity_id: null, payload, created_at: '2026-10-18T00:00:00Z' });

test('eventLabel renders Hebrew sentences and falls back to the raw action', () => {
  assert.match(E.eventLabel(evt('workshop.status', { from: 'confirmed', to: 'live' })), /חי/);
  assert.match(E.eventLabel(evt('participant.moved', { from: 'א', to: 'ב' })), /ב/);
  assert.match(E.eventLabel(evt('certificates.issued', { issued: 5, skipped: 1 })), /5/);
  assert.equal(E.eventLabel(evt('something.new')), 'something.new');
});

// ── curriculum.json mapping / roster cleaning ─────────────────────────
test('moduleRowFromJson yields a DB-valid slug, type and duration', () => {
  const row = K.moduleRowFromJson({
    id: 'core_s1_machine_vision_intro', title: 'מפגש 1', type: 'assessment', duration_min: 3,
    agenda: [{ minutes: 10, title: 'פתיחה', description: 'חוזה' }],
    exercises: [{ title: 'x', steps: ['a', 'b'], tool_hook: 'phone_tagger' }], materials: ['דפים'],
  });
  assert.match(row.slug, /^[a-z0-9-]{3,60}$/);
  assert.equal(row.slug, 'core-s1-machine-vision-intro');
  assert.equal(row.module_type, 'mixed');
  assert.equal(row.duration_minutes, 5);
  assert.equal(row.requires_app, true);
  assert.equal(row.exercises?.[0].instructions, 'a\nb');
});

test('templateRowFromJson maps formats and clamps group size', () => {
  const t = (format: string, size?: number) =>
    K.templateRowFromJson({ id: 'hackathon_day', title: 'T', format, modules: [], defaults: { group_size: { default: size } } });
  assert.equal(t('6 sessions').format, 'sessions');
  assert.equal(t('one day').format, 'hackathon');
  assert.equal(t('half day').format, 'custom');
  assert.equal(t('one day', 99).default_group_size, 8);
  assert.equal(t('one day').default_group_size, 4);
});

test('cleanNames trims, dedupes case-insensitively and caps at 80 chars', () => {
  assert.deepEqual(P.cleanNames(['  דנה ', '', 'דנה', 'Dan', 'dan']), ['דנה', 'Dan']);
  assert.equal(P.cleanNames(['א'.repeat(120)])[0].length, 80);
});
