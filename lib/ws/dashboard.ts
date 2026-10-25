// Data + pure helpers for the dashboard (/) and the read-only models mirror (/models).
// New file: existing lib/ws/* modules are reused, not edited.
import { sb } from '../db';
import { teamNames } from './groups';
import type { WorkshopWithOrg } from './workshops';
import type { WsEvent, WsGroup, WsSession } from './types';

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_DAYS = 7;
export const RECENT_EVENTS_LIMIT = 15;

// ── pure helpers ──────────────────────────────────────────────────────
const UPCOMING_ORDER: Record<string, number> = { confirmed: 0, proposal: 1, draft: 2 };

/** Live workshop first, then upcoming (confirmed, proposal, draft) by start date. Finished ones are hidden. */
export function myWorkshops(list: readonly WorkshopWithOrg[]): WorkshopWithOrg[] {
  const visible = list.filter((w) => w.status === 'live' || Object.hasOwn(UPCOMING_ORDER, w.status));
  const start = (w: WorkshopWithOrg): number => (w.starts_on ? Date.parse(w.starts_on) : Number.POSITIVE_INFINITY);
  return [...visible].sort((a, b) => {
    if ((a.status === 'live') !== (b.status === 'live')) return a.status === 'live' ? -1 : 1;
    return start(a) - start(b);
  });
}

export function weekWindow(now: Date): { from: string; to: string } {
  return { from: now.toISOString(), to: new Date(now.getTime() + WEEK_DAYS * DAY_MS).toISOString() };
}

export const isNewInstall = (c: { orgs: number; workshops: number }): boolean => c.orgs === 0 && c.workshops === 0;

export const accuracyPercent = (v: number | null): string => (v === null ? '' : `${Math.round(v * 100)}%`);

export interface ModelRow {
  id: string; team_name: string; name: string; accuracy: number | null; image_count: number | null;
  approved: boolean; created_at: string;
}
export type GroupRef = Pick<WsGroup, 'id' | 'number' | 'display_name' | 'team_name' | 'workshop_id'>;
export interface MatchedModel<G extends GroupRef = GroupRef> { model: ModelRow; group: G; personal: boolean }

/** A model belongs to a workshop group when its team_name is the group's team or the personal variant. */
export function matchModels<G extends GroupRef>(models: readonly ModelRow[], groups: readonly G[]): MatchedModel<G>[] {
  const byKey = new Map<string, { group: G; personal: boolean }>();
  for (const g of groups) {
    const [team, personal] = teamNames(g.team_name);
    byKey.set(team, { group: g, personal: false });
    byKey.set(personal, { group: g, personal: true });
  }
  return models.flatMap((model) => {
    const hit = byKey.get(model.team_name);
    return hit ? [{ model, group: hit.group, personal: hit.personal }] : [];
  });
}

// ── data ──────────────────────────────────────────────────────────────
export type SessionWithWorkshop = WsSession & { workshop: { id: string; title: string } | null };
export type EventWithWorkshop = WsEvent & { workshop: { id: string; title: string } | null };

export async function listWeekSessions(now: Date = new Date()): Promise<SessionWithWorkshop[]> {
  const { from, to } = weekWindow(now);
  const { data, error } = await sb.from('ws_sessions').select('*, workshop:ws_workshops(id, title)')
    .gte('scheduled_at', from).lt('scheduled_at', to).neq('status', 'cancelled')
    .order('scheduled_at').limit(50);
  if (error) throw error;
  return data as SessionWithWorkshop[];
}

export async function listRecentEvents(limit = RECENT_EVENTS_LIMIT): Promise<EventWithWorkshop[]> {
  const { data, error } = await sb.from('ws_events').select('*, workshop:ws_workshops(id, title)')
    .order('created_at', { ascending: false }).limit(limit);
  if (error) throw error;
  return data as EventWithWorkshop[];
}

export async function countOrganizations(): Promise<number> {
  const { count, error } = await sb.from('ws_organizations').select('id', { count: 'exact', head: true });
  if (error) throw error;
  return count ?? 0;
}

export type GroupWithWorkshop = GroupRef & { workshop: { id: string; title: string } | null };

export async function listGroupRefs(): Promise<GroupWithWorkshop[]> {
  const { data, error } = await sb.from('ws_groups')
    .select('id, number, display_name, team_name, workshop_id, workshop:ws_workshops(id, title)')
    .order('workshop_id').order('number');
  if (error) throw error;
  return data as unknown as GroupWithWorkshop[];
}

const TEAM_CHUNK = 40;

/** sc_models is publicly readable; queried by team key in chunks so the URL stays short for big rosters. */
export async function listModelsForTeams(teams: readonly string[]): Promise<ModelRow[]> {
  const chunks = Array.from({ length: Math.ceil(teams.length / TEAM_CHUNK) }, (_, i) =>
    teams.slice(i * TEAM_CHUNK, (i + 1) * TEAM_CHUNK));
  const pages = await Promise.all(chunks.map(async (keys) => {
    const { data, error } = await sb.from('sc_models')
      .select('id, team_name, name, accuracy, image_count, approved, created_at')
      .in('team_name', [...keys]).order('created_at', { ascending: false }).limit(500);
    if (error) throw error;
    return data as ModelRow[];
  }));
  return pages.flat().sort((a, b) => b.created_at.localeCompare(a.created_at));
}
