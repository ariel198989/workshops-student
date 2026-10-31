import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  decideLiveRoute, liveAllows, liveBanner, liveBlockedReason, liveNextStep, liveRouteOf, normalizeLive, LIVE_ROUTES,
  type LiveState,
} from '../lib/student/live.ts';

const live = (over: Partial<LiveState> = {}): LiveState => ({
  session_module_id: null, step_key: 'capture', label: 'מצלמים את האובייקט', allowed_routes: ['capture'],
  message: null, updated_at: '2026-10-31T10:00:00Z', ...over,
});

test('LIVE_ROUTES is the server allow-list', () => {
  assert.deepEqual([...LIVE_ROUTES], ['capture', 'tag', 'train', 'results', 'check', 'certificate']);
});

test('normalizeLive: null/garbage → null; a ws_my_context payload and a realtime row both normalize', () => {
  assert.equal(normalizeLive(null), null);
  assert.equal(normalizeLive('x'), null);
  const fromRpc = normalizeLive({ session_module_id: 'm1', step_key: 'tag', label: 'מתייגים', allowed_routes: ['tag', 'capture'], message: 'בזוגות', updated_at: 't' });
  assert.deepEqual(fromRpc, { session_module_id: 'm1', step_key: 'tag', label: 'מתייגים', allowed_routes: ['tag', 'capture'], message: 'בזוגות', updated_at: 't' });
  const fromRow = normalizeLive({ workshop_id: 'w', session_id: null, session_module_id: null, step_key: null, label: 'הפסקה', allowed_routes: [], message: null, updated_by: 'u', updated_at: 't2' });
  assert.deepEqual(fromRow, { session_module_id: null, step_key: null, label: 'הפסקה', allowed_routes: [], message: null, updated_at: 't2' });
});

test('normalizeLive drops unknown routes, duplicates and empty strings', () => {
  const l = normalizeLive({ allowed_routes: ['capture', 'admin', 'capture', 3], label: '  ', message: '' });
  assert.deepEqual(l?.allowed_routes, ['capture']);
  assert.equal(l?.label, null);
  assert.equal(l?.message, null);
  assert.equal(l?.updated_at, '');
});

test('liveAllows: null live opens everything, ungated routes are open, gated ones need the list', () => {
  assert.equal(liveAllows(null, 'capture'), true);
  assert.equal(liveAllows(live(), 'home'), true);
  assert.equal(liveAllows(live(), null), true);
  assert.equal(liveAllows(live(), 'capture'), true);
  assert.equal(liveAllows(live(), 'tag'), false);
  assert.equal(liveAllows(live({ allowed_routes: [] }), 'certificate'), false, 'a break closes every screen');
});

test('liveRouteOf: the five cycle routes and certificate; home, join and verify are never gated', () => {
  assert.equal(liveRouteOf('/capture'), 'capture');
  assert.equal(liveRouteOf('/tag/9'), 'tag');
  assert.equal(liveRouteOf('/certificate'), 'certificate');
  assert.equal(liveRouteOf('/'), null);
  assert.equal(liveRouteOf('/join'), null);
  assert.equal(liveRouteOf('/verify/abc'), null);
  assert.equal(liveRouteOf(null), null);
});

test('decideLiveRoute: blocked routes carry the facilitator sentence with the label', () => {
  assert.deepEqual(decideLiveRoute('/capture', live()), { allowed: true });
  assert.deepEqual(decideLiveRoute('/', live({ allowed_routes: [] })), { allowed: true });
  assert.deepEqual(decideLiveRoute('/tag', null), { allowed: true });
  const d = decideLiveRoute('/tag', live());
  assert.equal(d.allowed, false);
  if (!d.allowed) assert.equal(d.reason, 'המדריך יפתח את זה עוד רגע. עכשיו: מצלמים את האובייקט');
  assert.equal(liveBlockedReason(live({ label: null, step_key: 'tag' })), 'המדריך יפתח את זה עוד רגע. עכשיו: תייגו עכשיו');
});

test('liveBanner: label and message; a label-less step falls back to the step verb; nothing → null', () => {
  assert.deepEqual(liveBanner(null), null);
  assert.deepEqual(liveBanner(live({ message: 'בשקט' })), { label: 'מצלמים את האובייקט', message: 'בשקט' });
  assert.deepEqual(liveBanner(live({ label: null })), { label: 'צלמו עכשיו', message: null });
  assert.equal(liveBanner(live({ label: null, step_key: null })), null);
  assert.deepEqual(liveBanner(live({ label: null, step_key: 'weird', message: 'רגע' })), { label: 'המדריך מוביל', message: 'רגע' });
});

test('liveNextStep maps step keys to a route and a Hebrew verb; the message becomes the hint', () => {
  assert.deepEqual(liveNextStep(live()), { title: 'צלמו עכשיו', hint: 'מצלמים את האובייקט', href: '/capture' });
  assert.deepEqual(liveNextStep(live({ step_key: 'tag', allowed_routes: ['tag'], message: 'כל אחד 5 תמונות' })),
    { title: 'תייגו עכשיו', hint: 'כל אחד 5 תמונות', href: '/tag' });
  assert.equal(liveNextStep(live({ step_key: 'results', allowed_routes: ['results'] })).href, '/results');
  assert.equal(liveNextStep(live({ step_key: 'check', allowed_routes: ['check'] })).href, '/check');
  assert.equal(liveNextStep(live({ step_key: 'train', allowed_routes: ['train'] })).title, 'אמנו את המודל');
  assert.equal(liveNextStep(live({ step_key: 'certificate', allowed_routes: ['certificate'] })).href, '/certificate');
});

test('liveNextStep: a break or an unknown step points home with the label', () => {
  const brk = liveNextStep(live({ step_key: null, label: 'הפסקה', allowed_routes: [] }));
  assert.deepEqual(brk, { title: 'עכשיו: הפסקה', hint: 'המסך הגדול מוביל עכשיו', href: '/' });
  const closed = liveNextStep(live({ step_key: 'capture', allowed_routes: [] }));
  assert.equal(closed.href, '/', 'a step whose own route is closed does not link to it');
  const bare = liveNextStep(live({ step_key: null, label: null, allowed_routes: [] }));
  assert.equal(bare.title, 'עוקבים אחרי המדריך');
});
