import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isAlreadySaved, jobRow, jobZipPath, normalizeQueue, photoPath, photoRow } from '../lib/cv/ws-data.ts';

const media = { workshopId: '11111111-1111-4111-8111-111111111111', groupId: '22222222-2222-4222-8222-222222222222' };

test('photoPath is ASCII and sits under the group folder of its workshop', () => {
  const p = photoPath(media, 1760000000000, 'ab12c');
  assert.equal(p, `w/${media.workshopId}/g/${media.groupId}/p/1760000000000_ab12c.jpg`);
  assert.match(p, /^w\/[0-9a-f-]{36}\/g\/[0-9a-f-]{36}\/p\/\d+_[a-z0-9]+\.jpg$/);
});

test('jobZipPath sits under the same group folder, in jobs/', () => {
  const p = jobZipPath(media, 1760000000000, 'zz9aa');
  assert.equal(p, `w/${media.workshopId}/g/${media.groupId}/jobs/j_1760000000000_zz9aa.zip`);
  assert.match(p, /^w\/[0-9a-f-]{36}\/g\/[0-9a-f-]{36}\/jobs\/j_\d+_[a-z0-9]+\.zip$/);
});

test('two groups never share a folder', () => {
  const other = { ...media, groupId: '33333333-3333-4333-8333-333333333333' };
  assert.notEqual(photoPath(media, 1, 'a'), photoPath(other, 1, 'a'));
  assert.notEqual(jobZipPath(media, 1, 'a'), jobZipPath(other, 1, 'a'));
});

test('photoRow sends exactly the columns a student may insert into ws_photos', () => {
  const path = photoPath(media, 1, 'aaaaa');
  const row = photoRow({ path, className: 'כוס', team: 'ח1', groupId: media.groupId, userId: 'u1' });
  assert.deepEqual(Object.keys(row).sort(), ['class_name', 'detected_by', 'frame_path', 'group_id', 'status', 'team_name']);
  assert.deepEqual(row, {
    team_name: 'ח1', group_id: media.groupId, class_name: 'כוס', frame_path: path, detected_by: 'u1', status: 'dataset',
  });
});

test('photoRow ignores anything extra on the capture item (the blob never reaches the row)', () => {
  const item = { path: 'p', className: 'c', team: 't', groupId: 'g', userId: 'u', blob: 'bytes', lat: 1 };
  assert.equal(Object.keys(photoRow(item)).length, 6);
});

test('jobRow sends exactly the columns a student may insert into ws_training_jobs', () => {
  const classes = ['כוס', 'בקבוק'];
  const row = jobRow({ path: 'w/a/g/b/jobs/j_1_x.zip', count: 42, classes, team: 'ח1', groupId: media.groupId, userId: 'u1' });
  assert.deepEqual(Object.keys(row).sort(), ['classes', 'group_id', 'image_count', 'pool_zip_path', 'requested_by', 'team_name']);
  assert.equal(row.image_count, 42);
  assert.deepEqual(row.classes, classes);
  assert.notEqual(row.classes, classes, 'the caller list is copied, not shared');
});

test('isAlreadySaved: unique violation 23505 means the first insert landed', () => {
  assert.equal(isAlreadySaved({ code: '23505', message: 'duplicate key value violates unique constraint "ws_photos_frame_path_key"' }), true);
  assert.equal(isAlreadySaved({ code: '42501', message: 'new row violates row-level security policy for table "ws_photos"' }), false);
  assert.equal(isAlreadySaved({ code: '23503', message: 'group not found' }), false);
  assert.equal(isAlreadySaved({ message: 'duplicate' }), false, 'only the code counts, never the text');
  assert.equal(isAlreadySaved(null), false);
  assert.equal(isAlreadySaved('23505'), false);
});

test('normalizeQueue keeps the order of ws_training_queue() and drops malformed rows', () => {
  const raw = [
    { id: 'a', status: 'running', created_at: '2026-11-06T08:00:00Z' },
    { id: 'b', status: 'pending', created_at: '2026-11-06T08:05:00Z', team_name: 'ח9' },
    { id: 'c', status: 'pending' },
    { status: 'pending', created_at: '2026-11-06T08:06:00Z' },
    null,
  ];
  assert.deepEqual(normalizeQueue(raw), [
    { id: 'a', status: 'running', created_at: '2026-11-06T08:00:00Z' },
    { id: 'b', status: 'pending', created_at: '2026-11-06T08:05:00Z' },
  ]);
});

test('normalizeQueue answers an empty queue for anything that is not a list', () => {
  assert.deepEqual(normalizeQueue(null), []);
  assert.deepEqual(normalizeQueue(undefined), []);
  assert.deepEqual(normalizeQueue({ id: 'a' }), []);
});
