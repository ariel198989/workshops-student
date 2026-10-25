import Link from 'next/link';
import type { EventWithWorkshop } from '@/lib/ws/dashboard';
import { eventLabel } from '@/lib/ws/events';
import { relativeTime } from './format';
import styles from './dash.module.css';

/** "פעילות אחרונה": the last audit events, newest first. */
export function DashboardActivity({ events }: { events: readonly EventWithWorkshop[] }) {
  return (
    <section className={styles.section} aria-labelledby="dash-activity">
      <h2 id="dash-activity" className={styles.sectionTitle}>פעילות אחרונה</h2>
      {events.length === 0 ? (
        <div className={`hud ${styles.panelEmpty}`}>עדיין אין פעילות.</div>
      ) : (
        <ul className={`hud ${styles.list} ${styles.panel}`}>
          {events.map((e) => (
            <li key={e.id} className={styles.row}>
              <div className={styles.rowMain}>
                <span className={styles.rowTitle}>{eventLabel(e)}</span>
                {e.workshop ? (
                  <span className={styles.rowSub}><Link href={`/workshops/${e.workshop.id}/overview`}>{e.workshop.title}</Link></span>
                ) : null}
              </div>
              <span className={styles.rowEnd}>{relativeTime(e.created_at)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
