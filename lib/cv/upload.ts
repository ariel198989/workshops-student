'use client';
// Upload one captured frame into the group's folder of the private ws-media bucket
// and register it in ws_photos. No GPS, no location: a photo is a class name and a file.
import { sb, uploadMedia } from '../db';
import { isAlreadyUploaded, isNotLiveRejection, WORKSHOP_NOT_LIVE } from './capture-utils';
import type { GuardVerdict } from './face-guard';
import { isAlreadySaved, photoRow, type PhotoInput } from './ws-data';

export interface CaptureItem extends PhotoInput {
  blob: Blob;
  // `path` is fixed at snapshot time so a retry never creates an orphan upload
  /** the privacy guard's verdict at snapshot time: 'face' never reaches the queue */
  faceGuard: Exclude<GuardVerdict, 'face'>;
}

const uploaded = new Set<string>();

/** The object is in storage after this resolves: a fresh upload, or a 409 from one that landed earlier. */
async function ensureUploaded(item: CaptureItem): Promise<void> {
  try {
    await uploadMedia(item.path, item.blob, 'image/jpeg');
  } catch (e) {
    if (isNotLiveRejection(e)) throw new Error(WORKSHOP_NOT_LIVE);
    if (!isAlreadyUploaded(e)) throw e;
  }
}

export async function saveCapture(item: CaptureItem): Promise<void> {
  if (!uploaded.has(item.path)) {
    // fail open is a choice, so it is on record: this photo went up without the face check
    if (item.faceGuard === 'skipped') console.warn('[face-guard] uploading without a face check (detector unavailable):', item.path);
    await ensureUploaded(item);
    uploaded.add(item.path); // upload ok but insert failed: retry only the insert
  }
  const { error } = await sb.from('ws_photos').insert(photoRow(item));
  // 23505 = this frame_path is already a row: the first insert landed, only its answer was lost
  if (error && isNotLiveRejection(error)) throw new Error(WORKSHOP_NOT_LIVE);
  if (error && !isAlreadySaved(error)) throw new Error(error.message);
  uploaded.delete(item.path);
}
