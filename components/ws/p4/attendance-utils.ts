// Pure attendance helpers (no React, unit tested).
import type { AttendanceStatus } from '../../../lib/ws/types';

export const ATTENDANCE_CYCLE: readonly AttendanceStatus[] = ['present', 'late', 'absent', 'excused'];

export type MarkMap = ReadonlyMap<string, AttendanceStatus>;

export const markKey = (sessionId: string, participantId: string): string => `${sessionId}:${participantId}`;

/** unmarked -> present, then present -> late -> absent -> excused -> present */
export function nextAttendanceStatus(current: AttendanceStatus | undefined): AttendanceStatus {
  if (current === undefined) return ATTENDANCE_CYCLE[0];
  const i = ATTENDANCE_CYCLE.indexOf(current);
  return ATTENDANCE_CYCLE[(i + 1) % ATTENDANCE_CYCLE.length];
}

/**
 * Share of the taken sessions the participant attended (present or late).
 * Unmarked cells in a taken session count as missed. null when nothing was taken yet.
 */
export function rowRate(marks: MarkMap, participantId: string, takenSessionIds: readonly string[]): number | null {
  if (takenSessionIds.length === 0) return null;
  const attended = takenSessionIds.filter((sid) => {
    const s = marks.get(markKey(sid, participantId));
    return s === 'present' || s === 'late';
  }).length;
  return attended / takenSessionIds.length;
}

export const formatRate = (rate: number | null): string => (rate === null ? '-' : `${Math.round(rate * 100)}%`);

export interface Cell { readonly row: number; readonly col: number }
export interface GridDims { readonly rows: number; readonly cols: number }

const clamp = (n: number, max: number): number => Math.max(0, Math.min(max - 1, n));

/**
 * Keyboard navigation target for a grid key press, or null when the key is not a navigation key.
 * In RTL the first column is at the right edge, so ArrowLeft moves to the NEXT column.
 */
export function nextCell(from: Cell, key: string, dims: GridDims, rtl: boolean): Cell | null {
  const step = rtl ? -1 : 1;
  switch (key) {
    case 'ArrowRight': return { row: from.row, col: clamp(from.col + step, dims.cols) };
    case 'ArrowLeft': return { row: from.row, col: clamp(from.col - step, dims.cols) };
    case 'ArrowDown': return { row: clamp(from.row + 1, dims.rows), col: from.col };
    case 'ArrowUp': return { row: clamp(from.row - 1, dims.rows), col: from.col };
    case 'Home': return { row: from.row, col: 0 };
    case 'End': return { row: from.row, col: dims.cols - 1 };
    default: return null;
  }
}
