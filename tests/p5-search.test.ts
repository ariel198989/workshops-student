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

let S: typeof import('../components/ws/p5/cert-search.ts');
before(async () => {
  S = await import('../components/ws/p5/cert-search.ts');
});

const rows = [
  { recipient_name: 'דנה כהן', certificate_no: 'CW-2026-00001', group_name: 'קבוצה 1', workshop: { title: 'ראייה ממוחשבת' } },
  { recipient_name: 'Noam Levi', certificate_no: 'CW-2026-00002', group_name: null, workshop: { title: 'Hackathon' } },
  { recipient_name: 'יעל', certificate_no: 'CW-2026-00003', group_name: 'קבוצה 2', workshop: null },
];

test('empty or blank query returns everything', () => {
  assert.equal(S.filterCertificates(rows, '').length, 3);
  assert.equal(S.filterCertificates(rows, '   ').length, 3);
});

test('matches recipient, number, group and workshop, case-insensitively', () => {
  assert.deepEqual(S.filterCertificates(rows, 'דנה').map((r) => r.certificate_no), ['CW-2026-00001']);
  assert.deepEqual(S.filterCertificates(rows, 'noam').map((r) => r.certificate_no), ['CW-2026-00002']);
  assert.deepEqual(S.filterCertificates(rows, '00003').map((r) => r.recipient_name), ['יעל']);
  assert.deepEqual(S.filterCertificates(rows, 'קבוצה 2').map((r) => r.recipient_name), ['יעל']);
  assert.deepEqual(S.filterCertificates(rows, 'HACK').map((r) => r.recipient_name), ['Noam Levi']);
});

test('no match returns an empty list without mutating the input', () => {
  assert.deepEqual(S.filterCertificates(rows, 'zzz'), []);
  assert.equal(rows.length, 3);
});
