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

let E: typeof import('../components/ws/p6/errors.ts');

before(async () => {
  E = await import('../components/ws/p6/errors.ts');
});

test('errorCode reads the code from Error subclasses and plain PostgREST objects', () => {
  assert.equal(E.errorCode({ code: '23505', message: 'dup' }), '23505');
  assert.equal(E.errorCode(Object.assign(new Error('x'), { code: '42501' })), '42501');
  assert.equal(E.errorCode(new Error('x')), null);
  assert.equal(E.errorCode(null), null);
  assert.equal(E.errorCode('str'), null);
});

test('errText appends the message when there is one', () => {
  assert.equal(E.errText('השמירה נכשלה', new Error('boom')), 'השמירה נכשלה: boom');
  assert.equal(E.errText('השמירה נכשלה', { message: 'plain object' }), 'השמירה נכשלה: plain object');
  assert.equal(E.errText('השמירה נכשלה', undefined), 'השמירה נכשלה');
  assert.equal(E.errText('השמירה נכשלה', { message: '   ' }), 'השמירה נכשלה');
});

test('templateErrorText maps the one-default-per-format unique index to Hebrew', () => {
  const msg = E.templateErrorText({ code: '23505', message: 'duplicate key value violates unique constraint "ws_templates_one_default"' }, 'העדכון נכשל');
  assert.match(msg, /ברירת מחדל/);
  assert.ok(!/duplicate key/.test(msg));
});

test('templateErrorText maps permission and incomplete-id-set errors, else falls back', () => {
  assert.match(E.templateErrorText({ code: '42501', message: 'not authorized' }, 'x'), /הרשאה/);
  assert.match(E.templateErrorText({ code: '22023', message: 'p_ids must be' }, 'x'), /רעננו/);
  assert.equal(E.templateErrorText(new Error('weird'), 'הפעולה נכשלה'), 'הפעולה נכשלה: weird');
});
