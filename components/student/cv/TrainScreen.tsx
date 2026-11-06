'use client';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Spinner } from '@/components/ui/Spinner';
import { startTeamTrainingJob } from '@/lib/cv/jobs';
import { fetchPoolStats, type PoolStats } from '@/lib/cv/pool';
import { coverageRows, overallTier, trainBlockReason, trainErrorHe } from '@/lib/cv/readiness';
import { toast } from '@/lib/store';
import { poolUser, scopeOf } from '@/lib/student/context';
import { untaggedOf } from '@/lib/student/scope';
import { JobsPanel } from './JobsPanel';
import { ReadinessList } from './ReadinessList';
import { useTrainJobs } from './useTrainJobs';
import type { CvSession } from './CvGate';
import s from './cv.module.css';

const SUMMARY = {
  red: 'עוד חסרות תמונות. אפשר לאמן, אבל המודל יהיה חלש.',
  ok: 'יש בסיס טוב. עם עוד תמונות המודל ישתפר.',
  strong: 'דאטה חזק. מוכנים לאימון.',
} as const;

function Explain() {
  return (
    <div className={s.card}>
      <div className={s.cardHead}>מה קורה באימון</div>
      <p className={s.lead}>
        התמונות עם התיבות שסימנתם נארזות ונשלחות לשרת עם כרטיס גרפי. המודל מתרגל שוב ושוב: הוא מנחש איפה האובייקט,
        משווה לתיבה שלכם ומתקן את עצמו. בסוף חלק מהתמונות נשמרות בצד, והמודל נבחן עליהן.
      </p>
      <p className={`${s.small} ${s.lead}`}>
        זה לוקח בדרך כלל 15 עד 30 דקות, ותלוי בכמה קבוצות ממתינות לפניכם. מעט תמונות נותנות מודל חלש, וגם זה לימוד:
        התוצאות יראו לכם מה חסר.
      </p>
    </div>
  );
}

export function TrainScreen({ session }: { session: CvSession }) {
  const { team, media, userId, ctx } = session;
  const scope = scopeOf(ctx);
  const me = poolUser(scope, userId); // personal scope: my photos, my jobs; the trainer queue stays shared
  const [pool, setPool] = useState<PoolStats | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');
  const { jobs, active, ahead, alert, failed, justDone, refresh } = useTrainJobs(team, me);

  const loadPool = useCallback(() => fetchPoolStats(team, me).then(setPool).catch(() => setPool({ total: 0, byClass: [], contributors: 0 })), [team, me]);
  useEffect(() => { void loadPool(); }, [loadPool]);

  const targets = ctx.subproblem?.target_classes;
  const rows = useMemo(() => coverageRows(targets ?? [], pool?.byClass ?? []), [targets, pool]);
  const tier = overallTier(rows);
  const reason = pool ? trainBlockReason(pool.total, !!active, scope.personal) : 'בודקים כמה תמונות מתויגות יש';
  const untagged = scope.personal ? untaggedOf(ctx.mine) : ctx.progress?.untagged ?? 0;
  const hasModel = scope.personal ? ctx.mine.models > 0 : !!ctx.progress?.model;

  async function start() {
    setBusy(true);
    setError('');
    try {
      const r = await startTeamTrainingJob({ userId, team, media }, scope.personal, setProgress);
      // r.error may be raw database text; the mapper turns it into one Hebrew sentence
      if (!r.ok) setError(trainErrorHe(r.error));
      else { toast('משימת האימון נפתחה ונכנסה לתור.', true); navigator.vibrate?.(120); await refresh(); }
    } catch (e) {
      setError(trainErrorHe(e instanceof Error ? e.message : ''));
    } finally {
      setBusy(false);
      setProgress('');
    }
  }

  if (!pool && !jobs) return <div className={s.spin}><Spinner large /></div>;
  const canStart = !reason && !busy;
  // the latest job finished and there is a model (mine, or the group's): the next step goes first
  const modelReady = jobs?.[0]?.status === 'done' && hasModel;
  return (
    <div className={s.stack}>
      <h1 className={s.h1}>אימון המודל</h1>
      {modelReady ? <Link href="/results" className={`${s.btn} ${s.btnPrimary}`}>לשלב הבא: תוצאות</Link> : null}
      <div className={s.card}>
        <div className={s.cardHead}>
          {scope.personal
            ? <>התמונות המתויגות שלי · {pool?.total ?? 0}</>
            : <>תמונות מתויגות · {pool?.total ?? 0} מ-{pool?.contributors ?? 0} חברים</>}
        </div>
        <ReadinessList rows={rows} />
        <p className={`${s.note} ${tier === 'red' ? s.noteWarn : ''}`}>{SUMMARY[tier]}</p>
        {untagged > 0 ? (
          <p className={s.small}>עוד {untagged} תמונות מחכות לתיבה. <Link href="/tag" className={s.link}>לתיוג</Link></p>
        ) : null}
      </div>
      <Explain />
      <button type="button" className={`${s.btn} ${s.btnPrimary}`} disabled={!canStart} onClick={() => void start()}>
        {busy ? (progress || 'מכינים') : 'אמנו מודל'}
      </button>
      {reason && !busy ? <p className={`${s.small} ${s.center}`}>{reason}</p> : null}
      {error ? <p className={`${s.note} ${s.noteBad}`} role="alert">{error}</p> : null}
      <JobsPanel jobs={jobs ?? []} active={active} ahead={ahead} alert={alert} failed={failed} userId={userId} personal={scope.personal}
        justDone={justDone} onRetry={canStart ? () => void start() : undefined} onChanged={refresh} />
    </div>
  );
}
