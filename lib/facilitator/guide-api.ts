// Session plan for המפגש: two selects under staff RLS, grouped by session.
import { sb } from '@/lib/db';
import { groupModules, type ModuleRow, type SessionRow } from './guide';

export interface SessionPlan {
  sessions: SessionRow[];
  modulesBySession: Record<string, ModuleRow[]>;
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
