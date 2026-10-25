'use client';
import { useRef, useState, type KeyboardEvent } from 'react';
import { labelOf } from '@/lib/ws/labels';
import type { AttendanceStatus, WsParticipant, WsSession } from '@/lib/ws/types';
import { formatRate, markKey, nextCell, rowRate, type MarkMap } from './attendance-utils';
import { formatShortDate } from './format';
import styles from './people.module.css';

export type GridParticipant = Pick<WsParticipant, 'id' | 'full_name'>;
export type GridSession = Pick<WsSession, 'id' | 'session_no' | 'scheduled_at' | 'attendance_taken'>;

interface AttendanceGridProps {
  sessions: readonly GridSession[];
  participants: readonly GridParticipant[];
  marks: MarkMap;
  readOnly: boolean;
  onCycle: (sessionId: string, participantId: string) => void;
  onMarkAll: (sessionId: string) => void;
}

const SHORT: Record<AttendanceStatus, string> = { present: 'נוכח', late: 'איחר', absent: 'נעדר', excused: 'מוצדק' };

/**
 * Participants as rows, sessions as columns. Click or Space cycles a cell, arrows move focus
 * (roving tabindex), the name column stays put while the sessions scroll.
 */
export function AttendanceGrid({ sessions, participants, marks, readOnly, onCycle, onMarkAll }: AttendanceGridProps) {
  const cells = useRef(new Map<string, HTMLButtonElement>());
  const [active, setActive] = useState({ row: 0, col: 0 });
  const taken = sessions.filter((s) => s.attendance_taken).map((s) => s.id);
  const dims = { rows: participants.length, cols: sessions.length };

  const onKey = (e: KeyboardEvent, row: number, col: number) => {
    const target = nextCell({ row, col }, e.key, dims, true);
    if (!target) return;
    e.preventDefault();
    setActive(target);
    cells.current.get(`${target.row}:${target.col}`)?.focus();
  };

  return (
    <div className={styles.gridWrap}>
      <table className={styles.grid}>
        <thead>
          <tr>
            <th className={styles.stickyCol} scope="col">תלמיד</th>
            {sessions.map((s) => (
              <th key={s.id} scope="col">
                <div className={styles.colHead}>
                  <span className={styles.colNo}>מפגש {s.session_no}</span>
                  <span className={styles.colDate}>{formatShortDate(s.scheduled_at) ?? ''}</span>
                  {!readOnly ? <button type="button" className={`sm ${styles.allBtn}`} onClick={() => onMarkAll(s.id)}>סמנו את כולם נוכחים</button> : null}
                </div>
              </th>
            ))}
            <th scope="col">נוכחות</th>
          </tr>
        </thead>
        <tbody>
          {participants.map((p, row) => (
            <tr key={p.id}>
              <th className={`${styles.stickyCol} ${styles.nameCell}`} scope="row" title={p.full_name}>{p.full_name}</th>
              {sessions.map((s, col) => {
                const status = marks.get(markKey(s.id, p.id));
                const isActive = active.row === row && active.col === col;
                return (
                  <td key={s.id}>
                    <button type="button" ref={(el) => { if (el) cells.current.set(`${row}:${col}`, el); else cells.current.delete(`${row}:${col}`); }}
                      className={`${styles.cellBtn} ${styles[`s_${status ?? 'none'}`]}`}
                      tabIndex={isActive ? 0 : -1} aria-disabled={readOnly}
                      aria-label={`${p.full_name}, מפגש ${s.session_no}: ${status ? labelOf('attendance', status) : 'לא סומן'}`}
                      onFocus={() => setActive({ row, col })} onKeyDown={(e) => onKey(e, row, col)}
                      onClick={() => { if (!readOnly) onCycle(s.id, p.id); }}>
                      {status ? SHORT[status] : '·'}
                    </button>
                  </td>
                );
              })}
              <td className={styles.rate}>{formatRate(rowRate(marks, p.id, taken))}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
