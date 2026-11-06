// Session plan for המפגש: two selects under staff RLS, grouped by session.
import { sb } from '@/lib/db';
import { groupModules, type ModuleRow, type SessionRow } from './guide';

export interface SessionPlan {
  sessions: SessionRow[];
  modulesBySession: Record<string, ModuleRow[]>;
}

/**
 * The story of the workshop's curriculum template (ws_workshops.template_id → ws_curriculum_templates.story),
 * or null: no template, no story, or RLS hides templates from this account (only core staff read them).
 * Never throws: the opener box is a nice-to-have on top of the plan.
 */
export async function fetchTemplateStory(workshopId: string): Promise<unknown> {
  try {
    const { data, error } = await sb.from('ws_workshops')
      .select('template:ws_curriculum_templates(story)').eq('id', workshopId).maybeSingle();
    if (error || !data) return null;
    const t = (data as { template?: { story?: unknown } | { story?: unknown }[] | null }).template;
    return (Array.isArray(t) ? t[0]?.story : t?.story) ?? null;
  } catch {
    return null;
  }
}

export async function fetchSessionPlan(workshopId: string): Promise<SessionPlan> {
  const [s, m] = await Promise.all([
    sb.from('ws_sessions')
      .select('id,workshop_id,session_no,title,kind,scheduled_at,duration_minutes,status')
      .eq('workshop_id', workshopId)
      .order('session_no', { ascending: true }),
    sb.from('ws_session_modules')
      .select('id,session_id,workshop_id,position,title,module_type,duration_minutes,pipeline_stage,content')
      .eq('workshop_id', workshopId)
      .order('position', { ascending: true }),
  ]);
  if (s.error) throw new Error(s.error.message);
  if (m.error) throw new Error(m.error.message);
  return {
    sessions: (s.data ?? []) as SessionRow[],
    modulesBySession: groupModules((m.data ?? []) as ModuleRow[]),
  };
}
