import Link from 'next/link';
import type { SessionWithWorkshop } from '@/lib/ws/dashboard';
import { formatSessionTime } from './format';
import styles from './dash.module.css';

/** "מפגשים השבוע": the next seven days of ws_sessions with workshop, time and location. */
export function DashboardNextSessions({ sessions }: { sessions: readonly SessionWithWorkshop[] }) {
  return (
    <section className={styles.section} aria-labelledby="dash-sessions">
      <h2 id="dash-sessions" className={styles.sectionTitle}>מפגשים השבוע</h2>
      {sessions.length === 0 ? (
        <div className={`hud ${styles.panelEmpty}`}>אין מפגשים ב-7 הימים הקרובים.</div>
      ) : (
        <ul className={`hud ${styles.list} ${styles.panel}`}>
          {sessions.map((s) => (
            <li key={s.id} className={styles.row}>
              <div className={styles.rowMain}>
                <span className={styles.rowTitle}>
                  {s.workshop ? <Link href={`/workshops/${s.workshop.id}/sessions`}>{s.workshop.title}</Link> : s.title}
                </span>
                <span className={styles.rowSub}>
                  מפגש {s.session_no}: {s.title}{s.location ? `, ${s.location}` : ''}
                </span>
              </div>
              <span className={styles.rowEnd}>{s.scheduled_at ? formatSessionTime(s.scheduled_at) : ''}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
