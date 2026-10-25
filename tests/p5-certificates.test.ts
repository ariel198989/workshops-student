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

let T: typeof import('../lib/ws/certificate-templates.ts');
before(async () => {
  T = await import('../lib/ws/certificate-templates.ts');
});

const cert = {
  id: 'c1', workshop_id: 'w1', participant_id: 'p1', certificate_no: 'CW-2026-00042',
  verify_code: 'a'.repeat(32), recipient_name: 'דנה כהן', group_name: 'קבוצה 2',
  data: {
    workshop_title: 'ראייה ממוחשבת', organization: 'בית ספר אורט', starts_on: '2026-10-11', ends_on: '2026-10-18',
    hours: 12, subproblem: 'זיהוי מכשולים', task_type: 'detect',
  },
  status: 'issued' as const, issued_at: '2026-10-18T09:30:00Z', issued_by: null, pdf_path: null,
  revoked_at: null, revoke_reason: null,
};

test('pickVariant: custom format is corporate', () => {
  assert.equal(T.pickVariant({ format: 'custom', demoScore: 99 }), 'corporate');
});

test('pickVariant: score at 85 suggests distinction, below stays standard', () => {
  assert.equal(T.pickVariant({ format: 'sessions', demoScore: 85 }), 'distinction');
  assert.equal(T.pickVariant({ format: 'hackathon', demoScore: 84.99 }), 'standard');
  assert.equal(T.pickVariant({ format: 'sessions', demoScore: null }), 'standard');
});

test('pickVariant: a stored valid variant wins, garbage is ignored', () => {
  assert.equal(T.pickVariant({ format: 'sessions', demoScore: 10, stored: 'distinction' }), 'distinction');
  assert.equal(T.pickVariant({ format: 'sessions', demoScore: 10, stored: 'nope' }), 'standard');
});

test('fillTemplate substitutes once and never re-scans values', () => {
  const out = T.fillTemplate('{{student}} / {{org}}', { student: '{{org}}', workshop: 'w', date: 'd', org: 'ארגון' });
  assert.equal(out, '{{org}} / ארגון');
});

test('buildVerifyUrl joins origin and code without double slashes', () => {
  assert.equal(T.buildVerifyUrl('https://x.app/', 'abc'), 'https://x.app/verify/abc');
  assert.equal(T.buildVerifyUrl('https://x.app', 'abc'), 'https://x.app/verify/abc');
});

test('formatDateHe handles date-only and timestamps', () => {
  assert.equal(T.formatDateHe('2026-10-18'), '18 באוקטובר 2026');
  assert.equal(T.formatDateHe(null), '');
  assert.equal(T.formatDateHe('garbage'), '');
});

test('buildCertificateModel fills texts from the snapshot', () => {
  const m = T.buildCertificateModel(cert, 'standard', 'https://x.app');
  assert.equal(m.title, 'תעודת סיום');
  assert.equal(m.student, 'דנה כהן');
  assert.match(m.summary, /ראייה ממוחשבת/);
  assert.match(m.summary, /בית ספר אורט/);
  assert.equal(m.verifyUrl, `https://x.app/verify/${'a'.repeat(32)}`);
  assert.equal(m.hours, 12);
  assert.equal(m.datesRange, '11 באוקטובר 2026 - 18 באוקטובר 2026');
  assert.equal(m.subproblem, 'זיהוי מכשולים');
  assert.equal(m.revoked, false);
});

test('buildCertificateModel tolerates a sparse snapshot', () => {
  const m = T.buildCertificateModel({ ...cert, data: {}, group_name: null }, 'corporate', 'https://x.app');
  assert.equal(m.title, 'אישור השתתפות');
  assert.equal(m.hours, null);
  assert.equal(m.datesRange, null);
  assert.equal(m.groupName, null);
  assert.equal(m.learned, null);
});

test('every variant has distinct copy and two signatures', () => {
  for (const v of T.CERTIFICATE_VARIANT_LIST) {
    assert.equal(T.VARIANT_COPY[v].signatures.length, 2);
    assert.ok(T.VARIANT_LABELS[v].length > 0);
  }
  assert.notEqual(T.VARIANT_COPY.standard.title, T.VARIANT_COPY.distinction.title);
});
