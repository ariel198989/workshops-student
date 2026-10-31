// ws_live_state from the facilitator's side: read the current row, set a step, clear it. Staff RLS.
import { sb } from '@/lib/db';
import type { LiveStepArgs } from './live-step';

export interface LiveRow {
  workshop_id: string;
  session_module_id: string | null;
  step_key: string | null;
  label: string | null;
  allowed_routes: string[];
  message: string | null;
  updated_at: string;
}

function liveErrorHe(code: string | undefined, fallback: string): string {
  if (code === '42501') return 'רק צוות הסדנה יכול לשדר לכיתה.';
  if (code === '22023') return 'השידור לא תקין (מודול או מסך לא מוכרים).';
  return fallback;
}

export async function fetchLiveState(workshopId: string): Promise<LiveRow | null> {
  const { data, error } = await sb.from('ws_live_state')
    .select('workshop_id,session_module_id,step_key,label,allowed_routes,message,updated_at')
    .eq('workshop_id', workshopId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as LiveRow | null) ?? null;
}

export async function setLiveStep(args: LiveStepArgs): Promise<LiveRow> {
  const { data, error } = await sb.rpc('ws_set_live_step', args);
  if (error) throw new Error(liveErrorHe(error.code, 'השידור לכיתה לא הצליח. בדקו את החיבור ונסו שוב.'));
  return data as LiveRow;
}

export async function clearLiveStep(workshopId: string): Promise<void> {
  const { error } = await sb.rpc('ws_clear_live_step', { p_workshop: workshopId });
  if (error) throw new Error(liveErrorHe(error.code, 'ניקוי השידור לא הצליח. בדקו את החיבור ונסו שוב.'));
}
