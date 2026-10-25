import { sb } from '../../../lib/db';
import { lockDeliverable, reviewDeliverable, uploadPresentation } from '../../../lib/ws/deliverables';
import { normalizeTargetClasses } from '../../../lib/ws/workshops';
import type {
  DeliverablePatch, WorkshopFormat, WorkshopStatus, WsCertificate, WsDeliverable, WsProblem, WsSubproblem,
} from '../../../lib/ws/types';
import { hebrewDbError, type FailureCase } from './validation';

// Thin write helpers for columns the shared lib/ws functions do not cover. They update only the
// columns they are given (a partial upsert would trip the NOT NULL columns) and rethrow in Hebrew.

function fail(error: unknown): never {
  throw new Error(hebrewDbError(error));
}

export type ProblemPatch = Partial<Pick<WsProblem, 'client_name' | 'client_contact' | 'title' | 'statement'
  | 'context' | 'success_criteria' | 'status'>>;

export async function patchProblem(id: string, patch: ProblemPatch): Promise<void> {
  const { error } = await sb.from('ws_problems').update(patch).eq('id', id);
  if (error) fail(error);
}

export type SubproblemPatch = Partial<Pick<WsSubproblem, 'title' | 'statement' | 'task_type' | 'target_classes'
  | 'success_metric' | 'target_accuracy' | 'data_plan'>>;

export async function patchSubproblem(id: string, patch: SubproblemPatch): Promise<void> {
  const row = patch.target_classes ? { ...patch, target_classes: normalizeTargetClasses(patch.target_classes) } : patch;
  const { error } = await sb.from('ws_subproblems').update(row).eq('id', id);
  if (error) fail(error);
}

export type DeliverableExtraPatch = Partial<Pick<WsDeliverable, 'presentation_url' | 'presentation_path' | 'model_id'>>
  & { failure_cases?: readonly FailureCase[] };

export async function patchDeliverable(id: string, patch: DeliverableExtraPatch): Promise<void> {
  const { error } = await sb.from('ws_deliverables').update(patch).eq('id', id);
  if (error) fail(error);
}

// The shared lib throws raw PostgREST errors; these wrappers turn them into Hebrew Error messages.
export async function reviewSafe(id: string, patch: DeliverablePatch): Promise<WsDeliverable> {
  try {
    return await reviewDeliverable(id, patch);
  } catch (err) {
    return fail(err);
  }
}

export async function lockSafe(groupId: string, modelId?: string): Promise<WsDeliverable> {
  try {
    return await lockDeliverable(groupId, modelId);
  } catch (err) {
    return fail(err);
  }
}

const HEBREW_LETTER = /[֐-׿]/;

export async function uploadSafe(workshopId: string, groupId: string, file: File): Promise<string> {
  try {
    return await uploadPresentation(workshopId, groupId, file);
  } catch (err) {
    // the lib validates type and size with its own Hebrew messages
    if (err instanceof Error && HEBREW_LETTER.test(err.message)) throw err;
    return fail(err);
  }
}

export interface WorkshopHead {
  id: string; title: string; status: WorkshopStatus; format: WorkshopFormat; organization: string;
}

export async function getWorkshopHead(id: string): Promise<WorkshopHead> {
  const { data, error } = await sb.from('ws_workshops')
    .select('id, title, status, format, organization:ws_organizations(name)').eq('id', id).single();
  if (error) fail(error);
  const row = data as unknown as Omit<WorkshopHead, 'organization'> & { organization: { name: string } | null };
  return { ...row, organization: row.organization?.name ?? '' };
}

export type CertificateWithWorkshop = WsCertificate & { workshop: { title: string; code: string } | null };
const ALL_CERTIFICATES_LIMIT = 1000;

export async function listAllCertificates(): Promise<CertificateWithWorkshop[]> {
  const { data, error } = await sb.from('ws_certificates')
    .select('*, workshop:ws_workshops(title, code)').order('issued_at', { ascending: false }).limit(ALL_CERTIFICATES_LIMIT);
  if (error) fail(error);
  return data as CertificateWithWorkshop[];
}
