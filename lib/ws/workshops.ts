import { sb } from '../db';
import type {
  Overview, WorkshopFormat, WorkshopInsert, WorkshopPatch, WorkshopRole, WorkshopStatus,
  WsProblem, WsSession, WsSessionModule, WsSubproblem, WsWorkshop, WsWorkshopStaff, ModuleRunStatus,
} from './types';

export type WorkshopWithOrg = WsWorkshop & { organization: { name: string } };
export interface WorkshopFilter { status?: WorkshopStatus; organizationId?: string; format?: WorkshopFormat }

export async function listWorkshops(filter: WorkshopFilter = {}): Promise<WorkshopWithOrg[]> {
  let q = sb.from('ws_workshops').select('*, organization:ws_organizations(name)')
    .order('starts_on', { ascending: false, nullsFirst: true });
  if (filter.status) q = q.eq('status', filter.status);
  if (filter.organizationId) q = q.eq('organization_id', filter.organizationId);
  if (filter.format) q = q.eq('format', filter.format);
  const { data, error } = await q;
  if (error) throw error;
  return data as WorkshopWithOrg[];
}

export async function getWorkshop(id: string): Promise<WsWorkshop> {
  const { data, error } = await sb.from('ws_workshops').select('*').eq('id', id).single();
  if (error) throw error;
  return data as WsWorkshop;
}

export async function createWorkshop(input: WorkshopInsert): Promise<WsWorkshop> {
  const { data, error } = await sb.from('ws_workshops').insert(input).select().single();
  if (error) throw error;
  return data as WsWorkshop;
}

export async function updateWorkshop(id: string, patch: WorkshopPatch): Promise<WsWorkshop> {
  const { data, error } = await sb.from('ws_workshops').update(patch).eq('id', id).select().single();
  if (error) throw error;
  return data as WsWorkshop;
}

// status is not in the column grant: transitions (and sc_classes activation) go through the RPC
export async function setWorkshopStatus(id: string, status: WorkshopStatus): Promise<WsWorkshop> {
  const { data, error } = await sb.rpc('ws_set_workshop_status', { p_workshop: id, p_status: status });
  if (error) throw error;
  return data as WsWorkshop;
}

export async function fetchOverview(id: string): Promise<Overview> {
  const { data, error } = await sb.rpc('ws_workshop_overview', { p_workshop: id });
  if (error) throw error;
  return data as Overview;
}

export type WorkshopStaffRow = WsWorkshopStaff & { staff: { full_name: string; email: string; role: string } };

export async function listWorkshopStaff(id: string): Promise<WorkshopStaffRow[]> {
  const { data, error } = await sb.from('ws_workshop_staff')
    .select('*, staff:ws_staff(full_name, email, role)').eq('workshop_id', id);
  if (error) throw error;
  return data as WorkshopStaffRow[];
}

export async function assignStaff(workshopId: string, userId: string, role: WorkshopRole): Promise<void> {
  const { error } = await sb.from('ws_workshop_staff')
    .upsert({ workshop_id: workshopId, user_id: userId, role }, { onConflict: 'workshop_id,user_id' });
  if (error) throw error;
}

export async function unassignStaff(workshopId: string, userId: string): Promise<void> {
  const { error } = await sb.from('ws_workshop_staff').delete().eq('workshop_id', workshopId).eq('user_id', userId);
  if (error) throw error;
}

export type SessionPatch = Partial<Pick<WsSession, 'title' | 'kind' | 'scheduled_at' | 'duration_minutes'
  | 'status' | 'location' | 'started_at' | 'ended_at' | 'lead_user_id' | 'facilitator_log' | 'recap'>>;

export async function listSessions(workshopId: string): Promise<WsSession[]> {
  const { data, error } = await sb.from('ws_sessions').select('*').eq('workshop_id', workshopId).order('session_no');
  if (error) throw error;
  return data as WsSession[];
}

export async function updateSession(id: string, patch: SessionPatch): Promise<WsSession> {
  const { data, error } = await sb.from('ws_sessions').update(patch).eq('id', id).select().single();
  if (error) throw error;
  return data as WsSession;
}

export async function listSessionModules(sessionId: string): Promise<WsSessionModule[]> {
  const { data, error } = await sb.from('ws_session_modules').select('*').eq('session_id', sessionId).order('position');
  if (error) throw error;
  return data as WsSessionModule[];
}

export async function updateSessionModule(
  id: string, patch: { status?: ModuleRunStatus; notes?: string | null },
): Promise<WsSessionModule> {
  const { data, error } = await sb.from('ws_session_modules').update(patch).eq('id', id).select().single();
  if (error) throw error;
  return data as WsSessionModule;
}

// ids = the complete set of the session's module rows, in the new order
export async function reorderSessionModules(sessionId: string, ids: readonly string[]): Promise<void> {
  const { error } = await sb.rpc('ws_reorder_session_modules', { p_session: sessionId, p_ids: ids });
  if (error) throw error;
}

export async function listProblems(workshopId: string): Promise<WsProblem[]> {
  const { data, error } = await sb.from('ws_problems').select('*')
    .eq('workshop_id', workshopId).order('is_primary', { ascending: false }).order('created_at');
  if (error) throw error;
  return data as WsProblem[];
}

export async function saveProblem(input: Partial<WsProblem> & { workshop_id: string }): Promise<WsProblem> {
  const { data, error } = await sb.from('ws_problems').upsert(input).select().single();
  if (error) throw error;
  return data as WsProblem;
}

export async function listSubproblems(workshopId: string): Promise<WsSubproblem[]> {
  const { data, error } = await sb.from('ws_subproblems').select('*').eq('workshop_id', workshopId).order('position');
  if (error) throw error;
  return data as WsSubproblem[];
}

export async function saveSubproblem(
  input: Partial<WsSubproblem> & { workshop_id: string; problem_id: string },
): Promise<WsSubproblem> {
  const row = input.target_classes ? { ...input, target_classes: normalizeTargetClasses(input.target_classes) } : input;
  const { data, error } = await sb.from('ws_subproblems').upsert(row).select().single();
  if (error) throw error;
  return data as WsSubproblem;
}

export async function deleteSubproblem(id: string): Promise<void> {
  const { error } = await sb.from('ws_subproblems').delete().eq('id', id);
  if (error) throw error;
}

export const MAX_CLASS_LEN = 40;
export const MAX_CLASSES = 20;

/** Client mirror of ws_subproblems_normalize: quotes/newlines break YOLO data.yaml. DB stays the authority. */
export function normalizeTargetClasses(raw: readonly string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of raw) {
    const cls = item.replace(/['"\r\n]/g, '').trim().slice(0, MAX_CLASS_LEN).trim();
    const key = cls.toLowerCase();
    if (!cls || seen.has(key)) continue;
    seen.add(key);
    out.push(cls);
  }
  return out.slice(0, MAX_CLASSES);
}
