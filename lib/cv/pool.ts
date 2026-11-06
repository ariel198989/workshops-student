'use client';
// The group's training pool: stats for the readiness view and the YOLO dataset
// ZIP (data.yaml, images/, labels/, stratified split) built from ws_photos and
// the group's files in the private ws-media bucket.
import { sb, downloadMedia } from '../db';
import { POOL_LIMIT } from './config';
import { classIndexMap, packProblem, splitValGroups, groupKey, type ScreenVerdict } from './dataset';
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
  | { ok: true; blob: Blob; count: number; classes: string[]; excluded: { faces: number; unchecked: number } }
  | { ok: false; error: string };

export interface PackOptions {
  /** checks each downloaded photo before it goes in (the staff merge runs the face guard here) */
  screen?: (bytes: Uint8Array) => Promise<ScreenVerdict>;
}

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

/**
 * The YOLO dataset ZIP of the group's tagged photos, or of mine only when `me` is set. Photos are
 * downloaded (and screened, when asked) one at a time; the class list and the split follow the kept ones.
 */
export async function buildTeamPoolZip(
  team: string, me: string | null, onProgress: (done: number, total: number) => void, opts: PackOptions = {},
): Promise<BuiltZip> {
  const JSZip = (await import('jszip')).default;
  const all = await fetchPoolRows(team, me);
  if (!all.length) return { ok: false, error: 'אין עדיין תמונות מתויגות. תייגו קודם.' };

  const kept: { row: PoolRow; bytes: Uint8Array }[] = [];
  let failed = 0;
  let faces = 0;
  let unchecked = 0;
  for (let i = 0; i < all.length; i++) {
    onProgress(i + 1, all.length);
    const bytes = await fetchBytes(all[i].frame_path);
    if (!bytes) { failed++; continue; }
    const verdict = opts.screen ? await opts.screen(bytes).catch((): ScreenVerdict => 'unchecked') : 'keep';
    if (verdict === 'face') faces++;
    else if (verdict === 'unchecked') unchecked++;
    else kept.push({ row: all[i], bytes });
    await yieldToUi();
  }
  // a mostly-failed pack would train on almost nothing: abort loudly (left-out photos are not failures)
  const problem = packProblem({ total: all.length, kept: kept.length, failed, faces, unchecked });
  if (problem) return { ok: false, error: problem };

  const rows = kept.map((k) => k.row);
  const { names, idx } = classIndexMap(rows);
  const valGroups = splitValGroups(rows);
  const zip = new JSZip();
  zip.file('data.yaml',
    `# Workshops group pool\npath: .\ntrain: images/train\nval: images/val\n\n` +
    `nc: ${names.length}\nnames: [${names.map((n) => `'${n}'`).join(', ')}]\n`);

  kept.forEach(({ row: r, bytes }, i) => {
    const seg = valGroups.has(groupKey(r)) ? 'val' : 'train';
    const base = `pool_${String(i).padStart(4, '0')}`;
    zip.file(`images/${seg}/${base}.jpg`, bytes);
    zip.file(`labels/${seg}/${base}.txt`, `${yoloLabelLine(idx[r.class_name], r.bbox)}\n`);
  });

  const blob = await zip.generateAsync({ type: 'blob' });
  return { ok: true, blob, count: kept.length, classes: names, excluded: { faces, unchecked } };
}
