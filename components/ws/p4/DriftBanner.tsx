'use client';
import type { DriftEntry } from '@/lib/ws/types';
import styles from './board.module.css';

interface DriftBannerProps {
  drift: readonly DriftEntry[];
  canEdit: boolean;
  /** participants we can re-sync (id -> has a group on the board) */
  movable: ReadonlySet<string>;
  onSync: (participantId: string) => void;
}

/** Students whose phone is registered in a different team than the console says. */
export function DriftBanner({ drift, canEdit, movable, onSync }: DriftBannerProps) {
  if (drift.length === 0) return null;
  return (
    <section className={styles.drift} role="status" aria-label="אי התאמה בין הטלפון לקבוצה">
      <h3>{drift.length} תלמידים רשומים בטלפון בקבוצה אחרת</h3>
      <p>העברה לקבוצה מעדכנת את הטלפון של התלמיד לקבוצה שמוצגת כאן.</p>
      <ul>
        {drift.map((d) => (
          <li key={d.participant_id}>
            <b>{d.full_name}</b>
            <span className={styles.driftTeams}>
              בקונסולה <code>{d.expected_team}</code> בטלפון <code>{d.app_team ?? 'ללא קבוצה'}</code>
            </span>
            {canEdit && movable.has(d.participant_id) ? (
              <button type="button" className="sm" onClick={() => onSync(d.participant_id)}>העבר לקבוצה</button>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
