'use client';
// The group's training pool: stats for the readiness view and the YOLO dataset
// ZIP (data.yaml, images/, labels/, stratified split, capped negatives).
// Ported from Smart City lib/citypool.ts with the `team` scope only.
import { sb, publicUrl } from '../db';
import { POOL_LIMIT } from './config';
import { classIndexMap, splitValGroups, teamScope, groupKey } from './dataset';
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
  | { ok: true; blob: Blob; count: number; negatives: number; classes: string[] }
  | { ok: false; error: string };

// training-grade = a full frame + a human box, not rejected
async function fetchPoolRows(team: string): Promise<PoolRow[]> {
  const { data, error } = await sb.from('sc_detections')
    .select('class_name, frame_path, bbox, detected_by, created_at')
    .in('team_name', teamScope(team))
    .not('frame_path', 'is', null)
    .not('bbox', 'is', null)
    .neq('status', 'rejected')
    .order('created_at', { ascending: false })
    .limit(POOL_LIMIT);
  if (error) throw new Error(error.message);
  return (data ?? []) as PoolRow[];
}

export async function fetchPoolStats(team: string): Promise<PoolStats> {
  const rows = await fetchPoolRows(team);
  const counts = new Map<string, number>();
  const people = new Set<string>();
  for (const r of rows) {
    counts.set(r.class_name, (counts.get(r.class_name) ?? 0) + 1);
    if (r.detected_by) people.add(r.detected_by);
  }
  const byClass = [...counts].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
  return { total: rows.length, contributors: people.size, byClass };
}

// accepted "the AI was right" photos are background images (empty labels)
async function fetchAcceptedNegatives(limit: number): Promise<{ frame_path: string }[]> {
  const { data, error } = await sb.from('sc_feedback')
    .select('frame_path').eq('kind', 'negative').eq('status', 'accepted').limit(limit);
  return error ? [] : ((data ?? []) as { frame_path: string }[]);
}

async function fetchBytes(path: string): Promise<Uint8Array | null> {
  try {
    const res = await fetch(publicUrl(path));
    return res.ok ? new Uint8Array(await res.arrayBuffer()) : null;
  } catch {
    return null;
  }
}

const yieldToUi = () => new Promise<void>((r) => setTimeout(r, 0));

export async function buildTeamPoolZip(team: string, onProgress: (done: number, total: number) => void): Promise<BuiltZip> {
  const JSZip = (await import('jszip')).default;
  const rows = await fetchPoolRows(team);
  if (!rows.length) return { ok: false, error: 'אין עדיין תמונות מתויגות. תייגו קודם.' };

  const { names, idx } = classIndexMap(rows);
  const valGroups = splitValGroups(rows);
  const zip = new JSZip();
  zip.file('data.yaml',
    `# Workshops OS group pool\npath: .\ntrain: images/train\nval: images/val\n\n` +
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

  const negs = await fetchAcceptedNegatives(Math.ceil(ok / 4));
  let negOk = 0;
  for (let i = 0; i < negs.length; i++) {
    const bytes = await fetchBytes(negs[i].frame_path);
    if (!bytes) continue;
    const seg = i % 5 === 0 ? 'val' : 'train';
    const base = `neg_${String(i).padStart(4, '0')}`;
    zip.file(`images/${seg}/${base}.jpg`, bytes);
    zip.file(`labels/${seg}/${base}.txt`, '');
    negOk++;
  }

  const blob = await zip.generateAsync({ type: 'blob' });
  return { ok: true, blob, count: ok, negatives: negOk, classes: names };
}
