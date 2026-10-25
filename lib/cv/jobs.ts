'use client';
// Cloud training queue. The phone builds the YOLO ZIP, uploads it and opens a
// job; the Colab notebook claims pending jobs FIFO and registers the model
// under the job's team_name. Ported from Smart City lib/trainjobs.ts (scope 'team').
import { sb, uploadBlob } from '../db';
import { buildTeamPoolZip } from './pool';
import { MIN_TRAIN_IMAGES } from './config';

export interface TrainJob {
  id: string;
  status: string;
  image_count: number;
  classes: string[] | null;
  team_name: string | null;
  requested_by: string | null;
  created_at: string;
  completed_at: string | null;
}

export interface QueueEntry { id: string; status: string; created_at: string }

export async function fetchTeamJobs(team: string, limit = 5): Promise<TrainJob[]> {
  const { data, error } = await sb.from('sc_training_jobs')
    .select('*').eq('team_name', team).order('created_at', { ascending: false }).limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []) as TrainJob[];
}

/** Everyone's waiting jobs: the Colab trainer is shared, so the queue spans all groups. */
export async function fetchQueue(): Promise<QueueEntry[]> {
  const { data, error } = await sb.from('sc_training_jobs')
    .select('id, status, created_at').in('status', ['pending', 'running'])
    .order('created_at', { ascending: true }).limit(200);
  if (error) throw new Error(error.message);
  return (data ?? []) as QueueEntry[];
}

/** Cancel one of MY pending jobs. Returns false when nothing was cancelled (already claimed). */
export async function cancelOwnJob(id: string, userId: string): Promise<boolean> {
  const { data, error } = await sb.from('sc_training_jobs')
    .update({ status: 'cancelled' }).eq('id', id).eq('status', 'pending').eq('requested_by', userId).select('id');
  if (error) throw new Error(error.message);
  return (data ?? []).length > 0;
}

export type StartResult = { ok: true; job: TrainJob } | { ok: false; error: string };

export async function startTeamTrainingJob(
  userId: string, team: string, onProgress: (msg: string) => void,
): Promise<StartResult> {
  onProgress('אוספים את התמונות של הקבוצה');
  const built = await buildTeamPoolZip(team, (d, t) => onProgress(`אורזים ${d} מתוך ${t} תמונות`));
  if (!built.ok) return built;
  if (built.count < MIN_TRAIN_IMAGES) {
    return { ok: false, error: `יש רק ${built.count} תמונות מתויגות. צריך לפחות ${MIN_TRAIN_IMAGES}.` };
  }
  onProgress('מעלים את הדאטה לענן');
  const path = `jobs/j_${Date.now()}_${Math.random().toString(36).slice(2, 7)}.zip`; // ASCII-only key
  await uploadBlob(path, built.blob, 'application/zip');
  const { data, error } = await sb.from('sc_training_jobs').insert({
    pool_zip_path: path, image_count: built.count, classes: built.classes,
    requested_by: userId, team_name: team,
  }).select().single();
  if (error) return { ok: false, error: error.message };
  return { ok: true, job: data as TrainJob };
}
