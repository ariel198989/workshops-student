'use client';
// Data for /facilitator/merge under staff RLS: the group and its workshop. Packing and the job itself
// reuse lib/cv/pool.ts and lib/cv/jobs.ts with the whole group's pool (no personal filter).
import { sb } from '@/lib/db';
import type { MergeTarget } from './merge';

export interface MergeGroup {
  id: string;
  number: number;
  team_name: string;
  display_name: string | null;
  workshop_id: string;
  workshopTitle: string | null;
}

/** The group, only when it belongs to that workshop; null when RLS hides it or the ids do not match. */
export async function fetchMergeGroup(t: MergeTarget): Promise<MergeGroup | null> {
  const [g, w] = await Promise.all([
    sb.from('ws_groups').select('id, number, team_name, display_name, workshop_id').eq('id', t.groupId).maybeSingle(),
    sb.from('ws_workshops').select('title').eq('id', t.workshopId).maybeSingle(),
  ]);
  if (g.error) throw new Error(g.error.message);
  const row = g.data as Omit<MergeGroup, 'workshopTitle'> | null;
  if (!row || row.workshop_id !== t.workshopId) return null;
  return { ...row, workshopTitle: (w.data as { title?: string } | null)?.title ?? null };
}
