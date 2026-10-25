'use client';
// Upload one captured frame and register it in sc_detections. The exact same
// row Smart City's SeriesCollect writes for a series frame, minus GPS and campaigns.
import { sb, uploadBlob } from '../db';
import { DEFAULT_CITY } from './config';

export interface CaptureItem {
  blob: Blob;
  path: string; // fixed at snapshot time so a retry never creates an orphan upload
  className: string;
  team: string;
  userId: string;
}

/** The insert row. lat/lng are NOT NULL in Smart City, so the city centre stands in (no GPS prompt for kids). */
export function detectionRow(item: CaptureItem): Record<string, unknown> {
  return {
    lat: DEFAULT_CITY.center_lat,
    lng: DEFAULT_CITY.center_lng,
    class_name: item.className,
    confidence: 0,
    frame_path: item.path,
    detected_by: item.userId,
    team_name: item.team,
    credits: 0,
    heading: null,
    status: 'dataset', // training material, never a live incident
    campaign_id: null,
  };
}

const uploaded = new Set<string>();

export async function saveCapture(item: CaptureItem): Promise<void> {
  if (!uploaded.has(item.path)) {
    await uploadBlob(item.path, item.blob, 'image/jpeg');
    uploaded.add(item.path); // upload ok but insert failed: retry only the insert
  }
  const { error } = await sb.from('sc_detections').insert(detectionRow(item));
  if (error) throw new Error(error.message);
  uploaded.delete(item.path);
}
