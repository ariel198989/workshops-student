// Pure sort helpers for DataTable (no React, unit tested).

export type SortDir = 'asc' | 'desc';
export interface SortState { readonly key: string | null; readonly dir: SortDir }

const isNil = (v: unknown): v is null | undefined => v === null || v === undefined || v === '';

/** Numbers compare numerically, everything else with Hebrew-aware natural string order. */
export function compareValues(a: unknown, b: unknown): number {
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  if (typeof a === 'boolean' && typeof b === 'boolean') return Number(a) - Number(b);
  return String(a).localeCompare(String(b), 'he', { numeric: true, sensitivity: 'base' });
}

/** Returns a new array. Stable. Empty values always sort last, whatever the direction. */
export function sortRows<T>(rows: readonly T[], get: (row: T) => unknown, dir: SortDir): T[] {
  const sign = dir === 'asc' ? 1 : -1;
  return rows
    .map((row, index) => ({ row, index, value: get(row) }))
    .sort((x, y) => {
      if (isNil(x.value) || isNil(y.value)) {
        if (isNil(x.value) && isNil(y.value)) return x.index - y.index;
        return isNil(x.value) ? 1 : -1;
      }
      return sign * compareValues(x.value, y.value) || x.index - y.index;
    })
    .map((x) => x.row);
}

/** Header click cycle: asc, desc, off. A different column starts at asc. */
export function nextSort(current: SortState, key: string): SortState {
  if (current.key !== key) return { key, dir: 'asc' };
  if (current.dir === 'asc') return { key, dir: 'desc' };
  return { key: null, dir: 'asc' };
}
