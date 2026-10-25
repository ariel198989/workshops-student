import { HugeiconsIcon } from '@hugeicons/react';
import { Calendar01Icon } from '@hugeicons/core-free-icons';
import type { StudentContext } from '@/lib/student/context';
import { formatSessionWhen, pickNextSession } from '@/lib/student/labels';
import k from './kit.module.css';
import h from './home.module.css';

/** The next meeting, highlighted, above the compact list of all sessions. */
export function ScheduleCard({ sessions }: { sessions: StudentContext['sessions'] }) {
  if (sessions.length === 0) return null;
  const next = pickNextSession(sessions, new Date());
  const ordered = [...sessions].sort((a, b) => a.session_no - b.session_no);
  return (
    <section className={k.card}>
      <div className={k.cardHead}><HugeiconsIcon icon={Calendar01Icon} size={18} />המפגשים</div>
      {next ? (
        <div className={h.nextSession}>
          <span>{next.status === 'live' ? 'המפגש מתקיים עכשיו' : 'המפגש הבא'}</span>
          <b>{next.title}</b>
          <span>{formatSessionWhen(next.scheduled_at)}</span>
        </div>
      ) : null}
      <ul className={h.sessions}>
        {ordered.map((s) => (
          <li key={s.session_no}
            className={s.status === 'done' || s.status === 'cancelled' ? `${h.sessionRow} ${h.done}` : h.sessionRow}>
            <span className={h.sessionNo}>{s.session_no}</span>
            <span className={h.sessionTitle}>{s.title}{s.status === 'cancelled' ? ' (בוטל)' : ''}</span>
            <span className={h.sessionWhen}>{formatSessionWhen(s.scheduled_at)}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
