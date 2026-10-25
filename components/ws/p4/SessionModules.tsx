'use client';
import { useEffect, useState, type DragEvent, type KeyboardEvent } from 'react';
import { toast } from '@/lib/store';
import { labelOf, pillTone } from '@/lib/ws/labels';
import { listSessionModules, reorderSessionModules, updateSessionModule } from '@/lib/ws/workshops';
import { MODULE_RUN_STATUSES, type ModuleRunStatus, type WsSessionModule } from '@/lib/ws/types';
import { errorText } from './hooks';
import { reorderIds } from './drag';
import styles from './flow.module.css';

interface SessionModulesProps {
  sessionId: string;
  canEdit: boolean;
  onOpen: (module: WsSessionModule) => void;
}

const withPositions = (rows: readonly WsSessionModule[]): WsSessionModule[] =>
  rows.map((m, i) => ({ ...m, position: i + 1 }));

function applyOrder(rows: readonly WsSessionModule[], ids: readonly string[]): WsSessionModule[] {
  const byId = new Map(rows.map((m) => [m.id, m]));
  return withPositions(ids.flatMap((id) => byId.get(id) ?? []));
}

/** Modules of one meeting: status chips, drag reorder (Alt+arrows too), click opens the content drawer. */
export function SessionModules({ sessionId, canEdit, onOpen }: SessionModulesProps) {
  const [rows, setRows] = useState<WsSessionModule[] | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    listSessionModules(sessionId)
      .then((r) => { if (alive) setRows(r); })
      .catch((err) => { if (alive) { setRows([]); toast(errorText(err, 'טעינת המודולים נכשלה')); } });
    return () => { alive = false; };
  }, [sessionId]);

  const setStatus = async (m: WsSessionModule, status: ModuleRunStatus) => {
    if (status === m.status) return;
    setRows((cur) => cur && cur.map((x) => (x.id === m.id ? { ...x, status } : x)));
    try {
      await updateSessionModule(m.id, { status });
    } catch (err) {
      setRows((cur) => cur && cur.map((x) => (x.id === m.id ? { ...x, status: m.status } : x)));
      toast(errorText(err, 'עדכון הסטטוס נכשל'));
    }
  };

  const reorder = async (ids: string[]) => {
    const before = rows;
    if (!before) return;
    setRows(applyOrder(before, ids));
    try {
      await reorderSessionModules(sessionId, ids);
    } catch (err) {
      setRows(before);
      toast(errorText(err, 'שינוי הסדר נכשל'));
    }
  };

  const onDrop = (e: DragEvent, targetId: string) => {
    e.preventDefault();
    const from = dragId;
    setDragId(null);
    setOverId(null);
    if (!rows || !from || from === targetId) return;
    void reorder(reorderIds(rows.map((m) => m.id), from, targetId));
  };

  const onKey = (e: KeyboardEvent, index: number) => {
    if (!canEdit || !rows || !e.altKey || (e.key !== 'ArrowUp' && e.key !== 'ArrowDown')) return;
    const target = rows[index + (e.key === 'ArrowUp' ? -1 : 1)];
    if (!target) return;
    e.preventDefault();
    void reorder(reorderIds(rows.map((m) => m.id), rows[index].id, target.id));
  };

  if (rows === null) return <p className="hint">טוען מודולים</p>;
  if (rows.length === 0) return <p className="hint">אין מודולים במפגש הזה.</p>;
  return (
    <ul className={styles.modules} aria-label="מודולים">
      {rows.map((m, index) => (
        <li key={m.id}
          className={`${styles.module} ${dragId === m.id ? styles.dragging : ''} ${overId === m.id && dragId !== m.id ? styles.dropTarget : ''}`}
          draggable={canEdit}
          onDragStart={(e) => { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', m.id); setDragId(m.id); }}
          onDragEnd={() => { setDragId(null); setOverId(null); }}
          onDragOver={(e) => { if (dragId) { e.preventDefault(); setOverId(m.id); } }}
          onDrop={(e) => onDrop(e, m.id)}>
          {canEdit ? <span className={styles.grip} aria-hidden="true">⋮⋮</span> : null}
          <button type="button" className={styles.modOpen} onClick={() => onOpen(m)} onKeyDown={(e) => onKey(e, index)}
            aria-label={`${m.title}, פתיחת פרטים`}>
            <span className={styles.modTitle}>{m.title}</span>
            <span className={styles.modMeta}>{m.duration_minutes} דקות</span>
          </button>
          <span className={styles.chips} role="group" aria-label={`סטטוס: ${m.title}`}>
            {MODULE_RUN_STATUSES.map((st) => {
              const on = m.status === st;
              return (
                <button key={st} type="button" disabled={!canEdit && !on} aria-pressed={on}
                  className={`${styles.chipBtn} ${on ? `${styles.chipOn} ${styles[`chip_${pillTone('module', st)}`]}` : ''}`}
                  onClick={() => void setStatus(m, st)}>
                  {labelOf('module', st)}
                </button>
              );
            })}
          </span>
        </li>
      ))}
    </ul>
  );
}
