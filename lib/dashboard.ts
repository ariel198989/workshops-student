'use client';
import { sb } from './db';
import { startOfLocalDayISO } from './dashboard-time';

export interface QuickCounts {
  classes: number | undefined;
  models: number | undefined;
  pendingJobs: number | undefined;
  detectionsToday: number | undefined;
}

type CountResult = PromiseLike<{ count: number | null; error: unknown }>;

// a failed query yields undefined so one broken table never blanks the dashboard
async function settle(query: CountResult): Promise<number | undefined> {
  try {
    const { count, error } = await query;
    return error || count === null ? undefined : count;
  } catch {
    return undefined;
  }
}

const head = { count: 'exact' as const, head: true };

export async function fetchQuickCounts(): Promise<QuickCounts> {
  const [classes, models, pendingJobs, detectionsToday] = await Promise.all([
    settle(sb.from('sc_classes').select('id', head)),
    settle(sb.from('sc_models').select('id', head)),
    settle(sb.from('sc_training_jobs').select('id', head).eq('status', 'pending')),
    settle(sb.from('sc_detections').select('id', head).gte('created_at', startOfLocalDayISO())),
  ]);
  return { classes, models, pendingJobs, detectionsToday };
}
