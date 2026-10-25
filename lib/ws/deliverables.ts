import { sb } from '../db';
import type { CityModel, Detection } from '../types';
import { teamNames } from './groups';
import type { DeliverablePatch, WsDeliverable, WsGroup } from './types';

export type DeliverableWithGroup = WsDeliverable & { group: Pick<WsGroup, 'number' | 'display_name' | 'team_name'> };

export async function listDeliverables(workshopId: string): Promise<DeliverableWithGroup[]> {
  const { data, error } = await sb.from('ws_deliverables')
    .select('*, group:ws_groups(number, display_name, team_name)').eq('workshop_id', workshopId);
  if (error) throw error;
  return (data as DeliverableWithGroup[]).slice().sort((a, b) => a.group.number - b.group.number);
}

export async function reviewDeliverable(id: string, patch: DeliverablePatch): Promise<WsDeliverable> {
  const { data, error } = await sb.from('ws_deliverables').update(patch).eq('id', id).select().single();
  if (error) throw error;
  return data as WsDeliverable;
}

// freezes dataset_snapshot + model_snapshot, status becomes approved; modelId defaults to the best model
export async function lockDeliverable(groupId: string, modelId?: string): Promise<WsDeliverable> {
  const { data, error } = await sb.rpc('ws_lock_deliverable', { p_group: groupId, p_model: modelId ?? null });
  if (error) throw error;
  return data as WsDeliverable;
}

export async function fetchTeamModels(team: string): Promise<CityModel[]> {
  const { data, error } = await sb.from('sc_models').select('*')
    .in('team_name', teamNames(team)).order('created_at', { ascending: false });
  if (error) throw error;
  return data as CityModel[];
}

export async function fetchTeamPhotos(team: string, page: number, pageSize = 60): Promise<Detection[]> {
  const from = Math.max(0, page) * pageSize;
  const { data, error } = await sb.from('sc_detections').select('*')
    .in('team_name', teamNames(team)).not('frame_path', 'is', null).neq('status', 'rejected')
    .order('created_at', { ascending: false }).range(from, from + pageSize - 1);
  if (error) throw error;
  return data as Detection[];
}

const MIME_EXT: Record<string, string> = {
  'application/pdf': 'pdf', 'image/png': 'png', 'image/jpeg': 'jpg',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
};
export const MAX_PRESENTATION_BYTES = 50 * 1024 * 1024;

/**
 * Uploads to ws-private at w/{workshop}/g/{group}/presentation-{ts}.{ext} (ASCII key, matches the
 * storage policies in architecture 3.8) and records it in ws_deliverables.presentation_path.
 */
export async function uploadPresentation(workshopId: string, groupId: string, file: File): Promise<string> {
  const ext = MIME_EXT[file.type];
  if (!ext) throw new Error('סוג קובץ לא נתמך (PDF, PNG, JPG או PPTX)');
  if (file.size > MAX_PRESENTATION_BYTES) throw new Error('הקובץ גדול מ-50MB');
  const path = `w/${workshopId}/g/${groupId}/presentation-${Date.now()}.${ext}`;
  const up = await sb.storage.from('ws-private').upload(path, file, { contentType: file.type, upsert: false });
  if (up.error) throw up.error;
  const { error } = await sb.from('ws_deliverables').update({ presentation_path: path }).eq('group_id', groupId);
  if (error) throw error;
  return path;
}

// ── Demo Day rubric (curriculum.json demo_day_rubric_v1) ──────────────
export interface RubricCriterion { id: string; title: string; weight: number }
export interface Rubric { id: string; maxLevel: number; criteria: readonly RubricCriterion[] }

export const DEMO_DAY_RUBRIC: Rubric = {
  id: 'demo_day_rubric_v1', maxLevel: 4,
  criteria: [
    { id: 'computer_vision', title: 'ראייה ממוחשבת: דאטה ומודל', weight: 25 },
    { id: 'honesty_failure_analysis', title: 'כנות וניתוח כשלים', weight: 15 },
    { id: 'entrepreneurship', title: 'יזמות: הבנת הלקוח וערך', weight: 20 },
    { id: 'presentation_demo', title: 'הצגה והדגמה חיה', weight: 15 },
    { id: 'teamwork', title: 'עבודת צוות', weight: 15 },
    { id: 'creativity', title: 'יצירתיות', weight: 10 },
  ],
};

/** Sum of (level / maxLevel) * weight per criterion; unscored criteria count 0, levels clamp to 0..maxLevel. */
export function scoreRubric(scores: Readonly<Record<string, number>>, rubric: Rubric = DEMO_DAY_RUBRIC): number {
  const total = rubric.criteria.reduce((sum, c) => {
    const raw = scores[c.id];
    const level = Number.isFinite(raw) ? Math.min(rubric.maxLevel, Math.max(0, raw)) : 0;
    return sum + (level / rubric.maxLevel) * c.weight;
  }, 0);
  return Math.round(total * 100) / 100;
}
