'use client';
import Link from 'next/link';
import { useState, type DragEvent } from 'react';
import {
  balanceOf, dropBeforeId, type Balance, type BoardItem, type Column,
} from './board';
import type { TemplateRow } from './useTemplateBoard';
import { typeLabel } from './labels';
import styles from './board.module.css';

interface Props {
  columns: readonly Column[];
  rows: ReadonlyMap<string, TemplateRow>;
  items: readonly BoardItem[];
  /** minutes a session should fill (120 for 'sessions', else the template total) */
  target: number;
  canEdit: boolean;
  onMove: (id: string, toSession: number, beforeId: string | null) => void;
  onRemove: (id: string) => void;
  onAdd: (sessionNo: number) => void;
  onAddSession: () => void;
}

interface Hover { session: number; beforeId: string | null }

const TYPE_CLASS: Record<string, string> = {
  theory: styles.tTheory, practice: styles.tPractice, demo: styles.tDemo, mixed: styles.tMixed,
};
const SUM_CLASS: Record<Balance, string> = { under: '', ok: styles.sumOk, over: styles.sumOver };
const METER_CLASS: Record<Balance, string> = { under: '', ok: styles.meterOk, over: styles.meterOver };

/** Sessions as columns (RTL: session 1 is rightmost). HTML5 drag within and across columns. */
export function TemplateModuleList({ columns, rows, items, target, canEdit, onMove, onRemove, onAdd, onAddSession }: Props) {
  const [dragging, setDragging] = useState<string | null>(null);
  const [hover, setHover] = useState<Hover | null>(null);
  const minutesOf = new Map(items.map((i) => [i.id, i.minutes]));

  const end = () => { setDragging(null); setHover(null); };
  const drop = (e: DragEvent, h: Hover) => {
    e.preventDefault();
    e.stopPropagation();
    const id = dragging ?? e.dataTransfer.getData('text/plain');
    end();
    if (id) onMove(id, h.session, h.beforeId);
  };
  const over = (e: DragEvent, h: Hover) => {
    if (!dragging) return;
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
    if (hover?.session !== h.session || hover.beforeId !== h.beforeId) setHover(h);
  };
  const chipHover = (e: DragEvent<HTMLElement>, col: Column, index: number): Hover => {
    const box = e.currentTarget.getBoundingClientRect();
    return { session: col.session_no, beforeId: dropBeforeId(col.ids, index, e.clientY > box.top + box.height / 2) };
  };

  const neighbour = (col: Column, i: number, dir: -1 | 1): string | null =>
    dir === -1 ? col.ids[i - 1] ?? null : col.ids[i + 2] ?? null;

  return (
    <>
      <div className={styles.board}>
        {columns.map((col) => {
          const sum = col.ids.reduce((s, id) => s + (minutesOf.get(id) ?? 0), 0);
          const balance = balanceOf(sum, target);
          const isOver = hover?.session === col.session_no;
          return (
            <section key={col.session_no} className={`${styles.column} ${isOver ? styles.columnOver : ''}`}
              aria-label={`מפגש ${col.session_no}`}
              onDragOver={(e) => over(e, { session: col.session_no, beforeId: null })}
              onDrop={(e) => drop(e, { session: col.session_no, beforeId: null })}>
              <header className={styles.colHead}>
                <h3 className={styles.colTitle}>מפגש {col.session_no}</h3>
                <span className={`${styles.sum} ${SUM_CLASS[balance]}`} title="סכום הדקות מול היעד">
                  {sum} / {target} ד׳
                </span>
              </header>
              <div className={styles.meter} aria-hidden="true">
                <div className={`${styles.meterFill} ${METER_CLASS[balance]}`}
                  style={{ width: `${Math.min(100, target > 0 ? (sum / target) * 100 : 0)}%` }} />
              </div>
              <div className={styles.colBody}>
                {col.ids.map((id, i) => {
                  const row = rows.get(id);
                  if (!row) return null;
                  const mins = minutesOf.get(id) ?? 0;
                  const marked = isOver && hover?.beforeId === id;
                  return (
                    <article key={id} draggable={canEdit}
                      className={`${styles.chip} ${TYPE_CLASS[row.module.module_type] ?? ''} ${canEdit ? '' : styles.chipLocked} ${dragging === id ? styles.dragging : ''} ${marked ? styles.before : ''}`}
                      onDragStart={(e) => { e.dataTransfer.setData('text/plain', id); e.dataTransfer.effectAllowed = 'move'; setDragging(id); }}
                      onDragEnd={end}
                      onDragOver={(e) => over(e, chipHover(e, col, i))}
                      onDrop={(e) => drop(e, chipHover(e, col, i))}>
                      <div className={styles.chipTop}>
                        <span className={styles.chipTitle}>
                          <Link href={`/curriculum/modules/${row.module_id}`}>{row.module.title}</Link>
                        </span>
                        {canEdit ? (
                          <span className={styles.tools}>
                            <button type="button" className="ghost sm" aria-label="העלאה" disabled={i === 0}
                              onClick={() => onMove(id, col.session_no, neighbour(col, i, -1))}>▲</button>
                            <button type="button" className="ghost sm" aria-label="הורדה" disabled={i === col.ids.length - 1}
                              onClick={() => onMove(id, col.session_no, neighbour(col, i, 1))}>▼</button>
                            <button type="button" className="ghost sm" aria-label="הסרה מהמפגש" onClick={() => onRemove(id)}>✕</button>
                          </span>
                        ) : null}
                      </div>
                      <div className={styles.chipMeta}>
                        <span>{typeLabel(row.module.module_type)}</span>
                        <span className={row.duration_override !== null ? styles.override : ''}>{mins} ד׳</span>
                      </div>
                      {row.notes ? <div className={styles.hintText} title={row.notes}>{row.notes}</div> : null}
                    </article>
                  );
                })}
                {isOver && hover?.beforeId === null && dragging ? <div className={styles.endMark} /> : null}
                {col.ids.length === 0 ? <p className="hint">גררו לכאן מודול.</p> : null}
              </div>
              {canEdit ? (
                <div className={styles.colFoot}>
                  <button type="button" className="sm" onClick={() => onAdd(col.session_no)}>הוסיפו מודול</button>
                </div>
              ) : null}
            </section>
          );
        })}
      </div>
      {canEdit ? <div><button type="button" className="sm" onClick={onAddSession}>מפגש נוסף</button></div> : null}
    </>
  );
}
