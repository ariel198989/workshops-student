import { sb } from '../db';
import type {
  ModuleType, SessionKind, WorkshopFormat, WsCurriculumTemplate, WsModule, WsTemplateModule,
} from './types';

export type TemplateWithModules = WsCurriculumTemplate & {
  modules: (WsTemplateModule & { module: WsModule })[];
};
export type ModuleInput = Partial<WsModule> & Pick<WsModule, 'title' | 'module_type'>;
export type TemplateModuleInput = Pick<WsTemplateModule, 'template_id' | 'module_id' | 'session_no' | 'position'>
  & Partial<Pick<WsTemplateModule, 'session_title' | 'session_kind' | 'duration_override' | 'notes'>>;

// ws_modules_bump_version (trigger) raises `version` on content changes, no client bump needed
export async function listModules(includeArchived = false): Promise<WsModule[]> {
  let q = sb.from('ws_modules').select('*').order('title');
  if (!includeArchived) q = q.eq('is_archived', false);
  const { data, error } = await q;
  if (error) throw error;
  return data as WsModule[];
}

export async function saveModule(input: ModuleInput): Promise<WsModule> {
  const { data, error } = await sb.from('ws_modules').upsert(input).select().single();
  if (error) throw error;
  return data as WsModule;
}

export async function archiveModule(id: string): Promise<void> {
  const { error } = await sb.from('ws_modules').update({ is_archived: true }).eq('id', id);
  if (error) throw error;
}

export async function listTemplates(): Promise<WsCurriculumTemplate[]> {
  const { data, error } = await sb.from('ws_curriculum_templates').select('*')
    .eq('is_archived', false).order('is_default', { ascending: false }).order('title');
  if (error) throw error;
  return data as WsCurriculumTemplate[];
}

export async function getTemplate(id: string): Promise<TemplateWithModules> {
  const { data, error } = await sb.from('ws_curriculum_templates')
    .select('*, modules:ws_template_modules(*, module:ws_modules(*))').eq('id', id).single();
  if (error) throw error;
  const tpl = data as TemplateWithModules;
  return { ...tpl, modules: [...tpl.modules].sort((a, b) => a.position - b.position) };
}

export async function cloneTemplate(templateId: string, title: string, slug?: string): Promise<string> {
  const { data, error } = await sb.rpc('ws_clone_template', {
    p_template: templateId, p_title: title, p_slug: slug ?? null,
  });
  if (error) throw error;
  return data as string;
}

export async function addTemplateModule(input: TemplateModuleInput): Promise<WsTemplateModule> {
  const { data, error } = await sb.from('ws_template_modules').insert(input).select().single();
  if (error) throw error;
  return data as WsTemplateModule;
}

export async function removeTemplateModule(id: string): Promise<void> {
  const { error } = await sb.from('ws_template_modules').delete().eq('id', id);
  if (error) throw error;
}

// ids = the COMPLETE set of the template's rows in the new order (server rejects partial sets)
export async function reorderTemplateModules(templateId: string, ids: readonly string[]): Promise<void> {
  const { error } = await sb.rpc('ws_reorder_template_modules', { p_template: templateId, p_ids: ids });
  if (error) throw error;
}

/** Returns the number of sessions created. Fails (23505) if the workshop already has sessions. */
export async function instantiateCurriculum(
  workshopId: string, templateId?: string, firstSession?: string, intervalDays = 7,
): Promise<number> {
  const { data, error } = await sb.rpc('ws_instantiate_curriculum', {
    p_workshop: workshopId, p_template: templateId ?? null,
    p_first_session: firstSession ?? null, p_interval: `${intervalDays} days`,
  });
  if (error) throw error;
  return data as number;
}

// ── curriculum.json import ────────────────────────────────────────────
export interface CurriculumModuleJson {
  id: string; title: string; type: string; duration_min: number; tags?: string[]; objectives?: string[];
  agenda?: { minutes: number; title: string; description: string }[];
  exercises?: { title: string; steps?: string[]; tool_hook?: string }[];
  materials?: string[]; facilitator_notes?: string;
}
export interface CurriculumTemplateJson {
  id: string; title: string; format: string; modules: string[];
  defaults?: { group_size?: { default?: number }; session_types?: string[] };
}
export interface CurriculumFile { modules: CurriculumModuleJson[]; templates: CurriculumTemplateJson[] }

const slugOf = (id: string): string => id.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 60);
const clamp = (n: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, n));
const MODULE_TYPES: readonly string[] = ['theory', 'practice', 'demo'];

export function moduleRowFromJson(m: CurriculumModuleJson): Omit<ModuleInput, 'id'> & { slug: string } {
  const exercises = (m.exercises ?? []).map((x) => ({ ...x, instructions: (x.steps ?? []).join('\n') }));
  return {
    slug: slugOf(m.id), title: m.title,
    module_type: (MODULE_TYPES.includes(m.type) ? m.type : 'mixed') as ModuleType,
    // ws_modules has no agenda column: kept as readable lines in the summary
    summary: (m.agenda ?? []).map((a) => `${a.minutes}' ${a.title}: ${a.description}`).join('\n') || null,
    duration_minutes: clamp(m.duration_min, 5, 720), objectives: m.objectives ?? [], exercises,
    materials: (m.materials ?? []).map((label) => ({ label, kind: 'handout' })),
    facilitator_notes: m.facilitator_notes ?? null, tags: m.tags ?? [],
    requires_app: (m.exercises ?? []).some((x) => x.tool_hook && x.tool_hook !== 'none'),
  };
}

const FORMAT_BY_TEXT: Record<string, WorkshopFormat> = { '6 sessions': 'sessions', 'one day': 'hackathon' };

export function templateRowFromJson(t: CurriculumTemplateJson) {
  return {
    slug: slugOf(t.id), title: t.title, format: FORMAT_BY_TEXT[t.format] ?? 'custom' as WorkshopFormat,
    default_group_size: clamp(t.defaults?.group_size?.default ?? 4, 2, 8),
  };
}

// one session per module for the multi-session format, a single session for day formats
function templateModuleRows(t: CurriculumTemplateJson, templateId: string, idBySlug: Map<string, string>) {
  const perSession = templateRowFromJson(t).format === 'sessions';
  return t.modules.flatMap((mid, i) => {
    const module_id = idBySlug.get(slugOf(mid));
    if (!module_id) return [];
    const kind: SessionKind = !perSession ? 'other' : t.defaults?.session_types?.[i] === 'practical' ? 'practical' : 'regular';
    return [{ template_id: templateId, module_id, session_no: perSession ? i + 1 : 1, position: i + 1,
      session_title: perSession ? null : t.title, session_kind: kind }];
  });
}

/** Idempotent by slug. Never touches is_default; templates that already have rows keep them. */
export async function importCurriculumJson(json: CurriculumFile): Promise<{ modules: number; templates: number }> {
  const mods = await sb.from('ws_modules').upsert(json.modules.map(moduleRowFromJson), { onConflict: 'slug' }).select('id, slug');
  if (mods.error) throw mods.error;
  const tpls = await sb.from('ws_curriculum_templates').upsert(json.templates.map(templateRowFromJson), { onConflict: 'slug' }).select('id, slug');
  if (tpls.error) throw tpls.error;
  const idBySlug = new Map((mods.data as { id: string; slug: string }[]).map((m) => [m.slug, m.id]));
  const tplIds = (tpls.data as { id: string; slug: string }[]);
  const existing = await sb.from('ws_template_modules').select('template_id').in('template_id', tplIds.map((t) => t.id));
  if (existing.error) throw existing.error;
  const filled = new Set((existing.data as { template_id: string }[]).map((r) => r.template_id));
  const rows = json.templates.flatMap((t) => {
    const id = tplIds.find((x) => x.slug === slugOf(t.id))?.id;
    return id && !filled.has(id) ? templateModuleRows(t, id, idBySlug) : [];
  });
  if (rows.length > 0) {
    const ins = await sb.from('ws_template_modules').insert(rows);
    if (ins.error) throw ins.error;
  }
  return { modules: mods.data.length, templates: tpls.data.length };
}
