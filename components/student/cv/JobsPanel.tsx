'use client';
import Link from 'next/link';
import { useState } from 'react';
import { cancelOwnJob, type TrainJob } from '@/lib/cv/jobs';
import { friendlyError } from '@/lib/cv/capture-utils';
import { jobTone, waitLabel, type JobTone } from '@/lib/cv/readiness';
import { toast } from '@/lib/store';
import s from './cv.module.css';

const DOT: Record<JobTone, string> = { ok: s.dotOk, active: s.dotActive, wait: s.dotWait, off: '', bad: s.dotBad };
const STATUS: Record<string, string> = {
  pending: 'ממתינה בתור', running: 'מתאמנת עכשיו', done: 'הסתיימה', cancelled: 'בוטלה', failed: 'נכשלה',
};

interface Props {
  jobs: TrainJob[];
  active: TrainJob | null;
  ahead: number | null;
  userId: string;
  justDone: TrainJob | null;
  onChanged: () => Promise<void>;
}

function ActiveJob({ job, ahead, mine, onCancel, busy }: { job: TrainJob; ahead: number | null; mine: boolean; onCancel: () => void; busy: boolean }) {
  const age = waitLabel(Date.now() - Date.parse(job.created_at));
  return (
    <div className={`${s.note} ${s.noteWarn}`} role="status">
      <b className={s.pulse}>{job.status === 'running' ? 'המודל מתאמן עכשיו' : 'המשימה ממתינה בתור'}</b>
      <div>
        {job.image_count} תמונות · נפתחה לפני {age}
        {ahead !== null ? (ahead === 0 ? ' · אתם הבאים בתור' : ` · לפניכם ${ahead} משימות בתור`) : ''}
      </div>
      <div className={s.small}>העמוד מתעדכן לבד כל 15 שניות. אפשר לסגור ולחזור. אם זה לוקח הרבה זמן, פנו למדריך.</div>
      {job.status === 'pending' && mine ? (
        <button type="button" className={`${s.btn} ${s.btnSm}`} disabled={busy} onClick={onCancel}>ביטול המשימה</button>
      ) : null}
    </div>
  );
}

/** The live job status plus the group's recent jobs. Only my own pending job can be cancelled. */
export function JobsPanel({ jobs, active, ahead, userId, justDone, onChanged }: Props) {
  const [busy, setBusy] = useState(false);

  async function cancel() {
    if (!active) return;
    setBusy(true);
    try {
      const ok = await cancelOwnJob(active.id, userId);
      toast(ok ? 'המשימה בוטלה.' : 'לא הצלחנו לבטל. ייתכן שהמשימה כבר התחילה.', true);
      await onChanged();
    } catch (e) {
      toast(friendlyError(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={s.stack}>
      {justDone ? (
        <div className={s.note} role="status">
          <b>המודל מוכן!</b>
          <Link href="/results" className={`${s.btn} ${s.btnPrimary}`}>לתוצאות ולבדיקה</Link>
        </div>
      ) : null}
      {active ? <ActiveJob job={active} ahead={ahead} mine={active.requested_by === userId} onCancel={() => void cancel()} busy={busy} /> : null}
      {jobs.length > 0 ? (
        <div className={s.card}>
          <div className={s.cardHead}>משימות אחרונות של הקבוצה</div>
          <ul className={s.jobs}>
            {jobs.map((j) => (
              <li key={j.id} className={s.job}>
                <span className={`${s.dot} ${DOT[jobTone(j.status)]}`} aria-hidden />
                <span>{STATUS[j.status] ?? j.status}</span>
                <span className={s.num}>{j.image_count} תמונות</span>
                <span className={s.jobTime}>
                  {new Date(j.created_at).toLocaleString('he-IL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
