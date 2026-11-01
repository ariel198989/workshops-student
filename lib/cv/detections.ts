'use client';
// sc_detections reads/writes for the student cycle: capture counts, the tag
// queue, saving a box, rejecting a frame. RLS: signed-in users may insert and
// update their OWN rows; every sc_* table is publicly readable.
import { sb } from '../db';
import { countByClass, orderQueue, teamScope } from './dataset';
import type { NBox } from './geometry';

export interface QueueRow {
  id: string;
  class_name: string;
  frame_path: string;
  created_at: string;
  detected_by: string | null;
}

const COUNT_LIMIT = 1500;
const QUEUE_LIMIT = 300;

/**
 * ws_tag_detection raised P0002: the photo is gone, was rejected by someone else, or is no
 * longer training material. Either way there is nothing left to tag here; the queue moves on.
 */
export const ALREADY_HANDLED = 'התמונה הזאת כבר טופלה';
export const isAlreadyHandled = (e: unknown): boolean => e instanceof Error && e.message === ALREADY_HANDLED;

/**
 * Photos per class already captured (tagged or not, rejected excluded): the whole group's, or only
 * the ones `me` shot when the workshop's pool scope is personal.
 */
export async function fetchCaptureCounts(team: string, me: string | null): Promise<Record<string, number>> {
  let q = sb.from('sc_detections')
    .select('class_name')
    .in('team_name', teamScope(team))
    .not('frame_path', 'is', null)
    .neq('status', 'rejected');
  if (me) q = q.eq('detected_by', me);
  const { data, error } = await q.limit(COUNT_LIMIT);
  if (error) throw new Error(error.message);
  return countByClass((data ?? []) as { class_name: string }[]);
}

/** Frames of the group that still have no box. Mine first; teammates' only when asked. */
export async function fetchUntagged(team: string, userId: string, includeTeammates: boolean): Promise<QueueRow[]> {
  let q = sb.from('sc_detections')
    .select('id, class_name, frame_path, created_at, detected_by')
    .in('team_name', teamScope(team))
    .is('bbox', null)
    .not('frame_path', 'is', null)
    .neq('status', 'rejected');
  if (!includeTeammates) q = q.eq('detected_by', userId);
  const { data, error } = await q.order('created_at', { ascending: false }).limit(QUEUE_LIMIT);
  if (error) throw new Error(error.message);
  return orderQueue((data ?? []) as QueueRow[], userId);
}

// ws_tag_detection lets a student tag any training photo of their own group,
// not only the ones they shot (Smart City's RLS allows own rows only).
async function tag(id: string, bbox: NBox | null, className: string | null, reject: boolean): Promise<void> {
  const { error } = await sb.rpc('ws_tag_detection', {
    p_id: id, p_bbox: bbox, p_class: className, p_reject: reject,
  });
  if (!error) return;
  if (error.code === '42501') throw new Error('אפשר לתייג רק תמונות של הקבוצה שלכם.');
  if (error.code === 'P0002') throw new Error(ALREADY_HANDLED); // 'photo not found' and 'photo already handled'
  if (error.code === '22023') throw new Error('התיבה לא תקינה. ציירו אותה שוב בתוך התמונה.');
  throw new Error(error.message);
}

export async function saveBox(id: string, bbox: NBox, className: string, originalClass: string): Promise<void> {
  await tag(id, bbox, className !== originalClass ? className : null, false);
}

/** "No object in this photo": drops it from the dataset. */
export const rejectFrame = (id: string): Promise<void> => tag(id, null, null, true);

/** Undo of rejectFrame: a REJECTED row called with no box, no class and p_reject false goes back to 'dataset'. */
export const restoreFrame = (id: string): Promise<void> => tag(id, null, null, false);
