// Writes the template board needs that lib/ws/curriculum.ts does not expose.
// Reads and reorders stay in lib/ws/curriculum.ts (getTemplate, reorderTemplateModules, ...).
import { sb } from '@/lib/db';
import type { WsCurriculumTemplate } from '@/lib/ws/types';

export type TemplatePatch = Partial<Pick<WsCurriculumTemplate, 'title' | 'description' | 'is_default'>>;

export async function updateTemplate(id: string, patch: TemplatePatch): Promise<WsCurriculumTemplate> {
  const { data, error } = await sb.from('ws_curriculum_templates').update(patch).eq('id', id).select().single();
  if (error) throw error;
  return data as WsCurriculumTemplate;
}

/**
 * Cross-column drag: ws_reorder_template_modules only writes `position`, so the row's
 * session_no is updated first and the complete id list is reordered afterwards.
 */
export async function setRowSession(rowId: string, sessionNo: number): Promise<void> {
  const { error } = await sb.from('ws_template_modules').update({ session_no: sessionNo }).eq('id', rowId);
  if (error) throw error;
}
