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

let V: typeof import('../components/ws/p5/validation.ts');
before(async () => {
  V = await import('../components/ws/p5/validation.ts');
});

test('isHttpsUrl accepts https only', () => {
  assert.equal(V.isHttpsUrl('https://docs.google.com/presentation/d/1'), true);
  assert.equal(V.isHttpsUrl('  https://x.co/a  '), true);
  assert.equal(V.isHttpsUrl('http://x.co'), false);
  assert.equal(V.isHttpsUrl('javascript:alert(1)'), false);
  assert.equal(V.isHttpsUrl('https://'), false);
  assert.equal(V.isHttpsUrl('not a url'), false);
  assert.equal(V.isHttpsUrl(''), false);
});

test('parsePercent converts percent text to a 0..1 fraction', () => {
  assert.deepEqual(V.parsePercent('60'), { ok: true, value: 0.6 });
  assert.deepEqual(V.parsePercent(''), { ok: true, value: null });
  assert.deepEqual(V.parsePercent('100'), { ok: true, value: 1 });
  assert.equal(V.parsePercent('101').ok, false);
  assert.equal(V.parsePercent('-1').ok, false);
  assert.equal(V.parsePercent('abc').ok, false);
});

test('toPercent renders fractions as whole percents', () => {
  assert.equal(V.toPercent(0.6), 60);
  assert.equal(V.toPercent(0.333), 33);
  assert.equal(V.toPercent(null), null);
});

test('readFailureCases keeps only well formed entries', () => {
  const out = V.readFailureCases([
    { frame_path: 'a.jpg', note: 'x', kind: 'fn' },
    { frame_path: 'b.jpg', note: 5, kind: 'zzz' },
    'bad', null,
  ]);
  assert.deepEqual(out, [
    { frame_path: 'a.jpg', note: 'x', kind: 'fn' },
    { frame_path: 'b.jpg', note: '', kind: 'confusion' },
  ]);
});

test('hebrewDbError maps common Postgres failures', () => {
  assert.match(V.hebrewDbError(new Error('permission denied for table ws_problems')), /הרשאה/);
  assert.match(V.hebrewDbError({ message: 'new row violates check constraint', code: '23514' }), /ערך/);
  assert.equal(V.hebrewDbError('boom'), 'הפעולה נכשלה');
});
