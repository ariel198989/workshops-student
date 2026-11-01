'use client';
import Link from 'next/link';
import { useState } from 'react';
import { cancelOwnJob, type TrainJob } from '@/lib/cv/jobs';
import { friendlyError } from '@/lib/cv/capture-utils';
import {
  canCancelJob, failedLabel, JOB_ALERT_HE, jobFailureReason, jobTone, waitLabel, type JobAlert, type JobTone,
} from '@/lib/cv/readiness';
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
  alert: JobAlert | null;
  failed: TrainJob | null;
  userId: string;
  /** personal pool scope: the list holds my jobs only */
  personal: boolean;
  justDone: TrainJob | null;
  /** re-open a training job after a failure; undefined when training is blocked right now */
  onRetry?: () => void;
  onChanged: () => Promise<void>;
}

interface ActiveProps { job: TrainJob; ahead: number | null; alert: JobAlert | null; mine: boolean; onCancel: () => void; busy: boolean }

function ActiveJob({ job, ahead, alert, mine, onCancel, busy }: ActiveProps) {
  const age = waitLabel(Date.now() - Date.parse(job.created_at));
  const cancellable = canCancelJob(job, alert, mine);
  return (
    <div className={`${s.note} ${alert ? s.noteBad : s.noteWarn}`} role={alert ? 'alert' : 'status'}>
      <b className={alert ? '' : s.pulse}>
        {alert ? JOB_ALERT_HE[alert] : job.status === 'running' ? 'המודל מתאמן עכשיו' : 'המשימה ממתינה בתור'}
      </b>
      <div>
        {job.image_count} תמונות · נפתחה לפני {age}
        {ahead !== null ? (ahead === 0 ? ' · אתם הבאים בתור' : ` · לפניכם ${ahead} משימות בתור`) : ''}
      </div>
      <div className={s.small}>
        {alert
          ? 'אפשר לבטל את המשימה ולפתוח חדשה כשהמאמן יחזור לעבוד.'
          : 'העמוד מתעדכן לבד כל 15 שניות. אפשר לסגור ולחזור. אם זה לוקח הרבה זמן, פנו למדריך.'}
      </div>
      {cancellable ? (
        <button type="button" className={`${s.btn} ${s.btnSm}`} disabled={busy} onClick={onCancel}>ביטול המשימה</button>
      ) : null}
    </div>
  );
}

function FailedJob({ job, onRetry }: { job: TrainJob; onRetry?: () => void }) {
  return (
    <div className={`${s.note} ${s.noteBad}`} role="alert">
      <b>{failedLabel(jobFailureReason(job))}</b>
      <div className={s.small}>המשימה נפתחה ב-{fmtWhen(job.created_at)}. התמונות שלכם נשארו, אפשר לנסות שוב.</div>
      {onRetry ? <button type="button" className={`${s.btn} ${s.btnSm}`} onClick={onRetry}>נסו שוב</button> : null}
    </div>
  );
}

const fmtWhen = (iso: string): string =>
  new Date(iso).toLocaleString('he-IL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

/** The live job status plus the group's recent jobs. Only the requester cancels, and only when the rules allow. */
export function JobsPanel({ jobs, active, ahead, alert, failed, userId, personal, justDone, onRetry, onChanged }: Props) {
  const [busy, setBusy] = useState(false);

  async function cancel() {
    if (!active) return;
    setBusy(true);
    try {
      const ok = await cancelOwnJob(active.id, userId);
      toast(ok ? 'המשימה בוטלה.' : 'לא הצלחנו לבטל. ייתכן שהמשימה כבר הסתיימה.', ok);
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
      {active ? (
        <ActiveJob job={active} ahead={ahead} alert={alert} mine={active.requested_by === userId} onCancel={() => void cancel()} busy={busy} />
      ) : null}
      {failed && !justDone ? <FailedJob job={failed} onRetry={onRetry} /> : null}
      {jobs.length > 0 ? (
        <div className={s.card}>
          <div className={s.cardHead}>{personal ? 'המשימות האחרונות שלי' : 'משימות אחרונות של הקבוצה'}</div>
          <ul className={s.jobs}>
            {jobs.map((j) => (
              <li key={j.id} className={s.job}>
                <span className={`${s.dot} ${DOT[jobTone(j.status)]}`} aria-hidden />
                <span>{STATUS[j.status] ?? j.status}</span>
                <span className={s.num}>{j.image_count} תמונות</span>
                <span className={s.jobTime}>{fmtWhen(j.created_at)}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
