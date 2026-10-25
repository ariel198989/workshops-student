'use client';
import { useMemo, useState, type KeyboardEvent, type ReactNode } from 'react';
import { nextSort, sortRows, type SortState } from './sort';
import styles from './ws.module.css';

export interface Column<T> {
  key: string;
  header: ReactNode;
  render: (row: T) => ReactNode;
  /** enables header sorting; return the comparable value for a row */
  sortValue?: (row: T) => unknown;
  /** numeric column: end-aligned */
  num?: boolean;
  width?: string;
}

interface DataTableProps<T> {
  columns: readonly Column<T>[];
  rows: readonly T[];
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  empty: ReactNode;
  dense?: boolean;
}

const ARROW = { asc: '▲', desc: '▼' } as const;

export function DataTable<T>({ columns, rows, rowKey, onRowClick, empty, dense = false }: DataTableProps<T>) {
  const [sort, setSort] = useState<SortState>({ key: null, dir: 'asc' });
  const sorted = useMemo(() => {
    const col = columns.find((c) => c.key === sort.key);
    return col?.sortValue ? sortRows(rows, col.sortValue, sort.dir) : rows;
  }, [columns, rows, sort]);

  if (rows.length === 0) return <>{empty}</>;

  const onKey = (e: KeyboardEvent, row: T) => {
    if (onRowClick && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      onRowClick(row);
    }
  };

  return (
    <div className={`hud ${styles.tableWrap}`}>
      <table className={`tbl ${dense ? styles.dense : ''}`}>
        <thead>
          <tr>
            {columns.map((c) => {
              const active = sort.key === c.key;
              const ariaSort = active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : undefined;
              return (
                <th key={c.key} className={c.num ? 'num' : undefined} style={c.width ? { width: c.width } : undefined}
                  aria-sort={c.sortValue ? (ariaSort ?? 'none') : undefined}>
                  {c.sortValue ? (
                    <button type="button" className={styles.sortBtn} onClick={() => setSort(nextSort(sort, c.key))}>
                      {c.header}
                      {active ? <span className={styles.sortArrow} aria-hidden="true">{ARROW[sort.dir]}</span> : null}
                    </button>
                  ) : c.header}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {sorted.map((row) => (
            <tr key={rowKey(row)} className={onRowClick ? styles.clickable : undefined}
              tabIndex={onRowClick ? 0 : undefined}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              onKeyDown={onRowClick ? (e) => onKey(e, row) : undefined}>
              {columns.map((c) => (
                <td key={c.key} className={c.num ? 'num' : undefined}>{c.render(row)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
