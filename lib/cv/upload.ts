'use client';
// Upload one captured frame into the group's folder of the private ws-media bucket
// and register it in ws_photos. No GPS, no location: a photo is a class name and a file.
import { sb, uploadMedia } from '../db';
import { reloadStudentContext } from '../student/context';
import {
  classifyRefusal, FatalUploadError, isAlreadyUploaded, isAuthError, isNotLiveRejection, SESSION_EXPIRED, WORKSHOP_NOT_LIVE,
} from './capture-utils';
import type { UploadableVerdict } from './face-guard';
import { isAlreadySaved, photoRow, type PhotoInput } from './ws-data';

export interface CaptureItem extends PhotoInput {
  blob: Blob;
  // `path` is fixed at snapshot time so a retry never creates an orphan upload
  /** the privacy guard's verdict at snapshot time: only clear, or skipped after a hard detector failure */
  faceGuard: UploadableVerdict;
}

const uploaded = new Set<string>();

/**
 * The student-facing error for a refusal, or null for any other failure. A 42501 / RLS refusal means
 * "not live" only if a fresh ws_my_context says so; otherwise the session is the problem, and that is
 * fatal for the retry queue (it stops retrying until the student taps).
 */
async function refusalError(e: unknown): Promise<Error | null> {
  if (isAuthError(e)) return new FatalUploadError(SESSION_EXPIRED);
  if (!isNotLiveRejection(e)) return null;
  const ctx = await reloadStudentContext().catch(() => null);
  return classifyRefusal(ctx?.workshop.status) === 'not-live' ? new Error(WORKSHOP_NOT_LIVE) : new FatalUploadError(SESSION_EXPIRED);
}

/** The object is in storage after this resolves: a fresh upload, or a 409 from one that landed earlier. */
async function ensureUploaded(item: CaptureItem): Promise<void> {
  try {
    await uploadMedia(item.path, item.blob, 'image/jpeg');
  } catch (e) {
    const refused = await refusalError(e);
    if (refused) throw refused;
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
  if (error) {
    const refused = await refusalError(error);
    if (refused) throw refused;
    // 23505 = this frame_path is already a row: the first insert landed, only its answer was lost
    if (!isAlreadySaved(error)) throw new Error(error.message);
  }
  uploaded.delete(item.path);
}
