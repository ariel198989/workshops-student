'use client';
// Read-only gallery for the L1 flow: the kids shot photos on school tablets
// into sc_detections; the facilitator trains the pocket model from them.
// Reads only (every sc_* table is publicly readable); nothing is written.
import { publicUrl, sb } from '../db';
import { teamScope } from '../cv/dataset';

export const GALLERY_CAP_PER_CLASS = 60;
const GALLERY_LIMIT = 900;

export interface GalleryGroup { id: string; number: number; team_name: string; display_name: string | null }

export interface GalleryRow { class_name: string; frame_path: string; team_name: string; created_at: string }

export interface GalleryClass { name: string; count: number }

export async function fetchWorkshopGroups(workshopId: string): Promise<GalleryGroup[]> {
  const { data, error } = await sb.from('ws_groups')
    .select('id, number, team_name, display_name')
    .eq('workshop_id', workshopId)
    .order('number', { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as GalleryGroup[];
}

/** Newest frames of these groups (own + members' personal pools), rejected ones excluded. */
export async function fetchGalleryRows(teams: readonly string[]): Promise<GalleryRow[]> {
  if (teams.length === 0) return [];
  const { data, error } = await sb.from('sc_detections')
    .select('class_name, frame_path, team_name, created_at')
    .in('team_name', teams.flatMap((t) => teamScope(t)))
    .not('frame_path', 'is', null)
    .neq('status', 'rejected')
    .order('created_at', { ascending: false })
    .limit(GALLERY_LIMIT);
  if (error) throw new Error(error.message);
  return (data ?? []) as GalleryRow[];
}

/** Classes present in the gallery, most photographed first. */
export function galleryClasses(rows: readonly GalleryRow[]): GalleryClass[] {
  const counts = new Map<string, number>();
  for (const r of rows) counts.set(r.class_name, (counts.get(r.class_name) ?? 0) + 1);
  return [...counts.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
}

export const frameUrl = (row: GalleryRow): string => publicUrl(row.frame_path);
