// Pure logic for the template board: duration sums, session columns and drag moves.
// Everything is immutable; the UI turns the result into addTemplateModule / reorderTemplateModules calls.
import type { WorkshopFormat } from '@/lib/ws/types';

export interface BoardItem { id: string; session_no: number; position: number; minutes: number }
export interface Column { session_no: number; ids: string[] }
export type Balance = 'under' | 'ok' | 'over';

export const SESSION_TARGET_MINUTES = 120;

export const effectiveMinutes = (
  tm: { duration_override: number | null }, module: { duration_minutes: number },
): number => tm.duration_override ?? module.duration_minutes;

export function sessionTotals(items: readonly BoardItem[]): Record<number, number> {
  return items.reduce<Record<number, number>>(
    (acc, it) => ({ ...acc, [it.session_no]: (acc[it.session_no] ?? 0) + it.minutes }), {},
  );
}

export const totalMinutes = (items: readonly BoardItem[]): number => items.reduce((s, it) => s + it.minutes, 0);

/** 120 per session for the multi-session format; day formats compare against the whole template. */
export const sessionTarget = (format: WorkshopFormat, templateTotal: number): number =>
  format === 'sessions' ? SESSION_TARGET_MINUTES : templateTotal;

export function balanceOf(sum: number, target: number): Balance {
  if (sum > target) return 'over';
  return sum === target ? 'ok' : 'under';
}

/** Columns 1..max(session_no, minColumns), each holding its item ids ordered by position. */
export function buildColumns(items: readonly BoardItem[], minColumns = 1): Column[] {
  const count = Math.max(minColumns, ...items.map((i) => i.session_no), 0);
  const sorted = [...items].sort((a, b) => a.position - b.position);
  return Array.from({ length: count }, (_, i) => ({
    session_no: i + 1,
    ids: sorted.filter((it) => it.session_no === i + 1).map((it) => it.id),
  }));
}

/** The COMPLETE id list in board order: what ws_reorder_template_modules requires. */
export const flattenIds = (columns: readonly Column[]): string[] => columns.flatMap((c) => c.ids);

function withColumn(columns: readonly Column[], sessionNo: number): Column[] {
  if (columns.some((c) => c.session_no === sessionNo)) return [...columns];
  const filler = Array.from({ length: Math.max(0, sessionNo - columns.length) }, (_, i) =>
    ({ session_no: columns.length + i + 1, ids: [] as string[] }));
  return [...columns, ...filler];
}

/** Moves `id` into column `toSession`, before `beforeId` (null = end). Unknown ids and self drops are no-ops. */
export function moveItem(columns: readonly Column[], id: string, toSession: number, beforeId: string | null): Column[] {
  if (beforeId === id || !columns.some((c) => c.ids.includes(id))) return [...columns];
  const removed = columns.map((c) => ({ ...c, ids: c.ids.filter((x) => x !== id) }));
  return withColumn(removed, toSession).map((c) => {
    if (c.session_no !== toSession) return c;
    const at = beforeId === null ? -1 : c.ids.indexOf(beforeId);
    const ids = at < 0 ? [...c.ids, id] : [...c.ids.slice(0, at), id, ...c.ids.slice(at)];
    return { ...c, ids };
  });
}

const sessionOf = (columns: readonly Column[], id: string): number | null =>
  columns.find((c) => c.ids.includes(id))?.session_no ?? null;

/** The new session_no when the item crossed columns, else null (a pure reorder needs no session update). */
export function changedSession(before: readonly Column[], after: readonly Column[], id: string): number | null {
  const from = sessionOf(before, id);
  const to = sessionOf(after, id);
  return to !== null && to !== from ? to : null;
}

/**
 * Drop target for a chip hover. Dropping on the lower half of a chip inserts after it,
 * which is "before the next chip" (null when it is the last one).
 */
export function dropBeforeId(ids: readonly string[], hoverIndex: number, lowerHalf: boolean): string | null {
  const at = lowerHalf ? hoverIndex + 1 : hoverIndex;
  return at < ids.length ? ids[at] : null;
}

export interface TemplateStatRow {
  template_id: string; session_no: number; duration_override: number | null;
  module: { duration_minutes: number } | null;
}
export interface TemplateStat { sessions: number; minutes: number; modules: number }

/** Per-template card numbers: distinct sessions, total effective minutes, module count. */
export function templateStats(rows: readonly TemplateStatRow[]): Record<string, TemplateStat> {
  const sessions = new Map<string, Set<number>>();
  const out: Record<string, TemplateStat> = {};
  for (const r of rows) {
    const set = new Set(sessions.get(r.template_id)).add(r.session_no);
    sessions.set(r.template_id, set);
    const prev = out[r.template_id] ?? { sessions: 0, minutes: 0, modules: 0 };
    const mins = r.duration_override ?? r.module?.duration_minutes ?? 0;
    out[r.template_id] = { sessions: set.size, minutes: prev.minutes + mins, modules: prev.modules + 1 };
  }
  return out;
}
