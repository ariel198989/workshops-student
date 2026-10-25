import Link from 'next/link';
import { pillTone, labelOf } from '@/lib/ws/labels';
import type { SessionStatus } from '@/lib/ws/types';
import { formatShortDate } from './format';
import styles from './flow.module.css';

export interface TimelineSession {
  id: string;
  session_no: number;
  title: string;
  status: SessionStatus;
  scheduled_at: string | null;
}

interface SessionTimelineProps {
  workshopId: string;
  sessions: readonly TimelineSession[];
  /** defaults to the live session, else the first one not done */
  activeId?: string;
}

function pickActive(sessions: readonly TimelineSession[], activeId?: string): string | undefined {
  if (activeId) return activeId;
  return (sessions.find((s) => s.status === 'live') ?? sessions.find((s) => s.status !== 'done' && s.status !== 'cancelled'))?.id;
}

/** RTL stepper: session 1 on the right. Each step links to the sessions tab, anchored. */
export function SessionTimeline({ workshopId, sessions, activeId }: SessionTimelineProps) {
  const current = pickActive(sessions, activeId);
  return (
    <ol className={styles.timeline} aria-label="ציר מפגשים">
      {sessions.map((s) => {
        const tone = pillTone('session', s.status);
        const date = formatShortDate(s.scheduled_at);
        return (
          <li key={s.id} className={`${styles.step} ${s.id === current ? styles.current : ''}`}>
            <Link href={`/workshops/${workshopId}/sessions#s${s.session_no}`} className={styles.stepLink}
              aria-current={s.id === current ? 'step' : undefined}
              title={`${s.title}: ${labelOf('session', s.status)}`}>
              <span className={`${styles.dotNo} ${styles[tone]}`}>{s.session_no}</span>
              <span className={styles.stepTitle}>{s.title}</span>
              <span className={styles.stepDate}>{date ?? labelOf('session', s.status)}</span>
            </Link>
          </li>
        );
      })}
    </ol>
  );
}
