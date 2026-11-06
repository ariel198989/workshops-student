'use client';
// The group's training pool: stats for the readiness view and the YOLO dataset
// ZIP (data.yaml, images/, labels/, stratified split) built from ws_photos and
// the group's files in the private ws-media bucket.
import { sb, downloadMedia } from '../db';
import { POOL_LIMIT } from './config';
import { classIndexMap, splitValGroups, groupKey } from './dataset';
import { yoloLabelLine, type NBox } from './geometry';

export interface PoolStats {
  total: number;
  byClass: { name: string; count: number }[];
  contributors: number;
}

interface PoolRow {
  class_name: string;
  frame_path: string;
  bbox: NBox;
  detected_by: string | null;
  created_at: string;
}

export type BuiltZip =
  | { ok: true; blob: Blob; count: number; classes: string[] }
  | { ok: false; error: string };

// training-grade = a photo with a human box, not rejected. `me` set = only the photos I shot (personal scope).
async function fetchPoolRows(team: string, me: string | null): Promise<PoolRow[]> {
  let q = sb.from('ws_photos')
    .select('class_name, frame_path, bbox, detected_by, created_at')
    .eq('team_name', team)
    .not('bbox', 'is', null)
    .neq('status', 'rejected');
  if (me) q = q.eq('detected_by', me);
  const { data, error } = await q.order('created_at', { ascending: false }).limit(POOL_LIMIT);
  if (error) throw new Error(error.message);
  return (data ?? []) as PoolRow[];
}

export async function fetchPoolStats(team: string, me: string | null): Promise<PoolStats> {
  const rows = await fetchPoolRows(team, me);
  const counts = new Map<string, number>();
  const people = new Set<string>();
  for (const r of rows) {
    counts.set(r.class_name, (counts.get(r.class_name) ?? 0) + 1);
    if (r.detected_by) people.add(r.detected_by);
  }
  const byClass = [...counts].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
  return { total: rows.length, contributors: people.size, byClass };
}

// the bucket is private: an authenticated download, never a public URL
async function fetchBytes(path: string): Promise<Uint8Array | null> {
  try {
    return new Uint8Array(await (await downloadMedia(path)).arrayBuffer());
  } catch {
    return null;
  }
}

const yieldToUi = () => new Promise<void>((r) => setTimeout(r, 0));

/** The YOLO dataset ZIP of the group's tagged photos, or of mine only when `me` is set. */
export async function buildTeamPoolZip(team: string, me: string | null, onProgress: (done: number, total: number) => void): Promise<BuiltZip> {
  const JSZip = (await import('jszip')).default;
  const rows = await fetchPoolRows(team, me);
  if (!rows.length) return { ok: false, error: 'אין עדיין תמונות מתויגות. תייגו קודם.' };

  const { names, idx } = classIndexMap(rows);
  const valGroups = splitValGroups(rows);
  const zip = new JSZip();
  zip.file('data.yaml',
    `# Workshops group pool\npath: .\ntrain: images/train\nval: images/val\n\n` +
    `nc: ${names.length}\nnames: [${names.map((n) => `'${n}'`).join(', ')}]\n`);

  let ok = 0;
  let failed = 0;
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    onProgress(i + 1, rows.length);
    const bytes = await fetchBytes(r.frame_path);
    if (!bytes) { failed++; continue; }
    const seg = valGroups.has(groupKey(r)) ? 'val' : 'train';
    const base = `pool_${String(i).padStart(4, '0')}`;
    zip.file(`images/${seg}/${base}.jpg`, bytes);
    zip.file(`labels/${seg}/${base}.txt`, `${yoloLabelLine(idx[r.class_name], r.bbox)}\n`);
    ok++;
    await yieldToUi();
  }
  // a mostly-failed pack would train on almost nothing: abort loudly
  if (ok === 0 || failed > rows.length * 0.25) {
    return { ok: false, error: `${failed} מתוך ${rows.length} תמונות לא ירדו (רשת?). האימון בוטל, נסו שוב.` };
  }

  const blob = await zip.generateAsync({ type: 'blob' });
  return { ok: true, blob, count: ok, classes: names };
}
