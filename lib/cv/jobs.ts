'use client';
// Cloud training queue. The phone builds the YOLO ZIP, uploads it to the group's
// folder in ws-media and opens a row in ws_training_jobs; the trainer claims pending
// jobs FIFO and registers the model in ws_models under the job's group.
import { sb, uploadMedia } from '../db';
import { randomSuffix } from './capture-utils';
import { buildTeamPoolZip, type PackOptions } from './pool';
import { MIN_TRAIN_IMAGES } from './config';
import { jobRow, jobZipPath, normalizeQueue, type MediaScope, type QueueEntry } from './ws-data';

export type { QueueEntry } from './ws-data';

export interface TrainJob {
  id: string;
  /** pending | running | done | failed | cancelled */
  status: string;
  image_count: number;
  classes: string[] | null;
  team_name: string | null;
  requested_by: string | null;
  created_at: string;
  /** set by the trainer when it claims the job */
  started_at?: string | null;
  completed_at: string | null;
  /** the trainer's (or the staff's) reason on a failed job */
  failure_reason?: string | null;
}

/** The group's recent jobs, or only the ones `me` requested (personal scope). Newest first. */
export async function fetchTeamJobs(team: string, me: string | null, limit = 5): Promise<TrainJob[]> {
  let q = sb.from('ws_training_jobs').select('*').eq('team_name', team);
  if (me) q = q.eq('requested_by', me);
  const { data, error } = await q.order('created_at', { ascending: false }).limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []) as TrainJob[];
}

/**
 * Everyone's waiting jobs, oldest first: the trainer is one queue for all groups. RLS hides
 * other groups' rows, so this goes through ws_training_queue() (id, status and time only).
 */
export async function fetchQueue(): Promise<QueueEntry[]> {
  const { data, error } = await sb.rpc('ws_training_queue');
  if (error) throw new Error(error.message);
  return normalizeQueue(data);
}

/**
 * Cancel one of MY jobs. RLS lets the requester move pending or running to cancelled;
 * the UI only offers it for a pending job or a running one that is stuck.
 * Returns false when nothing changed (the job already finished).
 */
export async function cancelOwnJob(id: string, userId: string): Promise<boolean> {
  const { data, error } = await sb.from('ws_training_jobs')
    .update({ status: 'cancelled' }).eq('id', id).in('status', ['pending', 'running']).eq('requested_by', userId).select('id');
  if (error) throw new Error(error.message);
  return (data ?? []).length > 0;
}

export type StartResult =
  | { ok: true; job: TrainJob; excluded: { faces: number; unchecked: number } }
  | { ok: false; error: string };

/** Who opens the job: the signed-in student, their group's data key and its folder in ws-media. */
export interface JobOwner { userId: string; team: string; media: MediaScope }

/**
 * Pack, upload, open a job. In personal scope the ZIP holds only my tagged photos and the trainer
 * registers the model with owner = requested_by; team_name stays the group's either way.
 */
export async function startTeamTrainingJob(
  { userId, team, media }: JobOwner, personal: boolean, onProgress: (msg: string) => void, pack: PackOptions = {},
): Promise<StartResult> {
  onProgress(personal ? 'אוספים את התמונות שלך' : 'אוספים את התמונות של הקבוצה');
  const verb = pack.screen ? 'בודקים ואורזים' : 'אורזים';
  const built = await buildTeamPoolZip(team, personal ? userId : null, (d, t) => onProgress(`${verb} ${d} מתוך ${t} תמונות`), pack);
  if (!built.ok) return built;
  if (built.count < MIN_TRAIN_IMAGES) {
    return { ok: false, error: `יש רק ${built.count} תמונות מתויגות. צריך לפחות ${MIN_TRAIN_IMAGES}.` };
  }
  onProgress('מעלים את הדאטה לענן');
  const path = jobZipPath(media, Date.now(), randomSuffix()); // ASCII-only key
  await uploadMedia(path, built.blob, 'application/zip');
  const { data, error } = await sb.from('ws_training_jobs')
    .insert(jobRow({ path, count: built.count, classes: built.classes, team, groupId: media.groupId, userId }))
    .select().single();
  if (error) return { ok: false, error: error.message };
  return { ok: true, job: data as TrainJob, excluded: built.excluded };
}
