// Pure contract with the workshops' own tables and private bucket: where a group's files live in
// ws-media, the exact insert rows ws_photos and ws_training_jobs accept, and the queue RPC shape.
// No imports on purpose: unit tested under plain Node.

/** The two ids every storage path of a group starts with (ws_my_context: workshop.id, group.id). */
export interface MediaScope { workshopId: string; groupId: string }

const groupDir = (m: MediaScope): string => `w/${m.workshopId}/g/${m.groupId}`;

/** A photo's key in ws-media. ASCII only. It is also ws_photos.frame_path, which is unique. */
export const photoPath = (m: MediaScope, now: number, rand: string): string => `${groupDir(m)}/p/${now}_${rand}.jpg`;

/** A dataset ZIP's key in ws-media (ws_training_jobs.pool_zip_path). */
export const jobZipPath = (m: MediaScope, now: number, rand: string): string => `${groupDir(m)}/jobs/j_${now}_${rand}.zip`;

export interface PhotoInput {
  path: string;
  className: string;
  team: string;
  groupId: string;
  userId: string;
}

/** The ws_photos insert row: exactly the columns a student may send; the database rejects any other. */
export function photoRow(p: PhotoInput) {
  return {
    team_name: p.team,
    group_id: p.groupId,
    class_name: p.className,
    frame_path: p.path,
    detected_by: p.userId,
    status: 'dataset' as const, // training material; a box is added later through ws_tag_detection
  };
}

export interface JobInput {
  path: string;
  count: number;
  classes: readonly string[];
  team: string;
  groupId: string;
  userId: string;
}

/** The ws_training_jobs insert row: exactly the columns a student may send. */
export function jobRow(j: JobInput) {
  return {
    team_name: j.team,
    group_id: j.groupId,
    pool_zip_path: j.path,
    image_count: j.count,
    classes: [...j.classes],
    requested_by: j.userId,
  };
}

/**
 * Postgres unique violation: frame_path is unique in ws_photos, so a retry whose first insert
 * landed (only the answer was lost) gets 23505. The photo is saved, not failed.
 */
export function isAlreadySaved(e: unknown): boolean {
  return !!e && typeof e === 'object' && (e as { code?: unknown }).code === '23505';
}

export interface QueueEntry { id: string; status: string; created_at: string }

/** What ws_training_queue() returns: every open job of every group, oldest first. Malformed rows are dropped. */
export function normalizeQueue(raw: unknown): QueueEntry[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((r): QueueEntry[] => {
    if (!r || typeof r !== 'object') return [];
    const { id, status, created_at } = r as Record<string, unknown>;
    return typeof id === 'string' && typeof status === 'string' && typeof created_at === 'string'
      ? [{ id, status, created_at }]
      : [];
  });
}
