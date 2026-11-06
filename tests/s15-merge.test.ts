import { test } from 'node:test';
import assert from 'node:assert/strict';
import { contributorsLabel, groupLabel, isStaffOfWorkshop, parseMergeParams } from '../lib/facilitator/merge.ts';
import type { Whoami } from '../lib/ws/types.ts';

const W = '11111111-1111-4111-8111-111111111111';
const G = '22222222-2222-4222-8222-222222222222';
const OTHER = '33333333-3333-4333-8333-333333333333';

const who = (staff: Whoami['staff'], workshops: string[] = []): Whoami => ({
  user_id: 'u', staff, workshops: workshops.map((workshop_id) => ({ workshop_id, role: 'instructor' })), participations: [],
});

test('parseMergeParams takes two uuids and nothing else', () => {
  assert.deepEqual(parseMergeParams(W, G), { workshopId: W, groupId: G });
  assert.deepEqual(parseMergeParams(` ${W} `, G), { workshopId: W, groupId: G });
  assert.equal(parseMergeParams(W, null), null);
  assert.equal(parseMergeParams(null, G), null);
  assert.equal(parseMergeParams('free', G), null);
  assert.equal(parseMergeParams(W, `${G}' or 1=1`), null);
});

test('isStaffOfWorkshop mirrors ws_is_workshop_staff: admins everywhere, others only where assigned', () => {
  assert.equal(isStaffOfWorkshop(who({ role: 'owner', full_name: 'a' }), W), true);
  assert.equal(isStaffOfWorkshop(who({ role: 'admin', full_name: 'a' }), W), true);
  assert.equal(isStaffOfWorkshop(who({ role: 'instructor', full_name: 'a' }, [W]), W), true);
  assert.equal(isStaffOfWorkshop(who({ role: 'instructor', full_name: 'a' }, [OTHER]), W), false);
  assert.equal(isStaffOfWorkshop(who({ role: 'guest', full_name: 'a' }, [W]), W), true);
});

test('a student (no staff row) or a missing whoami is refused, even with a workshop assignment row', () => {
  assert.equal(isStaffOfWorkshop(who(null, [W]), W), false);
  assert.equal(isStaffOfWorkshop(null, W), false);
});

test('groupLabel and contributorsLabel', () => {
  assert.equal(groupLabel({ display_name: 'הנשרים', number: 2 }), 'הנשרים');
  assert.equal(groupLabel({ display_name: '  ', number: 2 }), 'קבוצה 2');
  assert.equal(groupLabel({ display_name: null, number: 5 }), 'קבוצה 5');
  assert.equal(contributorsLabel(0), 'עוד אף אחד לא תייג תמונות');
  assert.equal(contributorsLabel(1), 'חבר אחד בקבוצה תייג תמונות');
  assert.equal(contributorsLabel(4), '4 חברים בקבוצה תייגו תמונות');
});
