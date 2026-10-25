// Pure dataset rules shared by the pool export, the tag queue and the model
// picker. No imports on purpose: unit tested under plain Node.

const PERSONAL_PREFIX = 'אישי · ';
const BURST_WINDOW_MS = 600000;

/** A group's pool = its own shots + its members' personal ones, never another group's. */
export const teamScope = (team: string): [string, string] => [team, `${PERSONAL_PREFIX}${team}`];

interface GroupRow { class_name: string; detected_by: string | null; created_at: string }

/** Burst key: same shooter + class + 10-minute window. Near-duplicates must land on one side. */
export function groupKey(r: GroupRow): string {
  return `${r.detected_by || 'anon'}|${r.class_name}|${Math.floor(new Date(r.created_at).getTime() / BURST_WINDOW_MS)}`;
}

/**
 * Stratified, group-aware ~20% validation split. A naive global split can send
 * every group of one class to val, leaving it with no training images (a dead
 * class that then predicts garbage), so groups are held out per class and the
 * last train group of a class is never taken.
 */
export function splitValGroups(rows: GroupRow[]): Set<string> {
  const byClass = new Map<string, string[]>();
  for (const r of rows) {
    const g = groupKey(r);
    const list = byClass.get(r.class_name) ?? [];
    if (!list.includes(g)) list.push(g);
    byClass.set(r.class_name, list);
  }
  const val = new Set<string>();
  for (const groups of byClass.values()) {
    if (groups.length <= 1) continue;
    const take = Math.min(Math.max(1, Math.floor(groups.length * 0.2)), groups.length - 1);
    groups.slice(0, take).forEach((g) => val.add(g));
  }
  return val;
}

export function classIndexMap(rows: { class_name: string }[]): { names: string[]; idx: Record<string, number> } {
  const names: string[] = [];
  const idx: Record<string, number> = {};
  for (const r of rows) {
    if (idx[r.class_name] == null) { idx[r.class_name] = names.length; names.push(r.class_name); }
  }
  return { names, idx };
}

export function countByClass(rows: { class_name: string }[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const r of rows) out[r.class_name] = (out[r.class_name] ?? 0) + 1;
  return out;
}

/** Tag queue: my own frames first, then teammates'; newest first inside each part. */
export function orderQueue<T extends { detected_by: string | null; created_at: string }>(rows: T[], me: string): T[] {
  const newest = (a: T, b: T) => Date.parse(b.created_at) - Date.parse(a.created_at);
  const mine = rows.filter((r) => r.detected_by === me).sort(newest);
  const others = rows.filter((r) => r.detected_by !== me).sort(newest);
  return [...mine, ...others];
}

interface PickableModel { owner: string | null; team_name: string; zip_path: string | null; approved: boolean }

/** The group's model: newest approved model it owns (list is newest first). No city fallback for students. */
export function pickTeamModel<T extends PickableModel>(models: T[], userId: string | null, team: string): T | null {
  const [t, personal] = teamScope(team);
  const mine = (m: T) => (userId != null && m.owner === userId) || m.team_name === t || m.team_name === personal;
  return models.find((m) => !!m.zip_path && m.approved && mine(m)) ?? null;
}
