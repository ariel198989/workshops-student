'use client';
// /facilitator/merge: staff trains ONE model for a group from every member's tagged photos.
// Same packing (lib/cv/pool.ts) and job code (lib/cv/jobs.ts) as the student's training screen,
// with the whole group's pool; the job is opened under the staff account (requested_by = staff),
// so ws-register-model files the result as the group's model (scope 'group').
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Spinner } from '@/components/ui/Spinner';
import { JobsPanel } from '@/components/student/cv/JobsPanel';
import { ReadinessList } from '@/components/student/cv/ReadinessList';
import { useTrainJobs } from '@/components/student/cv/useTrainJobs';
import { startTeamTrainingJob } from '@/lib/cv/jobs';
import { fetchPoolStats, type PoolStats } from '@/lib/cv/pool';
import { coverageRows, trainBlockReason, trainErrorHe } from '@/lib/cv/readiness';
import { toast } from '@/lib/store';
import { contributorsLabel, groupLabel, MERGE_BUTTON } from '@/lib/facilitator/merge';
import type { MergeGroup } from '@/lib/facilitator/merge-api';
import s from '@/components/student/cv/cv.module.css';

/** The whole group's pool: no personal filter, whatever the workshop's pool_scope says. */
const WHOLE_GROUP = null;

export function MergeTrainer({ group, staffUserId }: { group: MergeGroup; staffUserId: string }) {
  const team = group.team_name;
  const media = useMemo(() => ({ workshopId: group.workshop_id, groupId: group.id }), [group]);
  const [pool, setPool] = useState<PoolStats | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');
  // jobs: the ones this staff member opened for the group (the merged runs); the trainer queue stays shared
  const { jobs, active, ahead, alert, failed, justDone, refresh } = useTrainJobs(team, staffUserId);

  const loadPool = useCallback(
    () => fetchPoolStats(team, WHOLE_GROUP).then(setPool).catch(() => setPool({ total: 0, byClass: [], contributors: 0 })),
    [team],
  );
  useEffect(() => { void loadPool(); }, [loadPool]);

  const rows = useMemo(() => coverageRows([], pool?.byClass ?? []), [pool]);
  const reason = pool ? trainBlockReason(pool.total, !!active, false) : 'בודקים כמה תמונות מתויגות יש';

  async function start() {
    setBusy(true);
    setError('');
    try {
      // personal = false: the ZIP holds every member's tagged photos
      const r = await startTeamTrainingJob({ userId: staffUserId, team, media }, false, setProgress);
      if (!r.ok) setError(trainErrorHe(r.error));
      else { toast('משימת האימון הקבוצתי נפתחה ונכנסה לתור.', true); await refresh(); }
    } catch (e) {
      setError(trainErrorHe(e instanceof Error ? e.message : ''));
    } finally {
      setBusy(false);
      setProgress('');
      void loadPool();
    }
  }

  if (!pool && !jobs) return <div className={s.spin}><Spinner large /></div>;
  const canStart = !reason && !busy;
  return (
    <div className={s.stack}>
      <div>
        <h1 className={s.h1}>מודל קבוצתי · {groupLabel(group)}</h1>
        {group.workshopTitle ? <p className={s.small}>{group.workshopTitle}</p> : null}
      </div>
      <div className={s.card}>
        <div className={s.cardHead}>תמונות מתויגות של כל הקבוצה · {pool?.total ?? 0}</div>
        <p className={s.small}>{contributorsLabel(pool?.contributors ?? 0)}</p>
        {rows.length > 0 ? <ReadinessList rows={rows} /> : null}
      </div>
      <p className={s.small}>
        האימון אורז את כל התמונות המתויגות של כל חברי הקבוצה, גם כשכל תלמיד מאמן מודל משלו. המודל שייצא יופיע לתלמידים בתור &quot;המודל של הקבוצה&quot;.
      </p>
      <button type="button" className={`${s.btn} ${s.btnPrimary}`} disabled={!canStart} onClick={() => void start()}>
        {busy ? (progress || 'מכינים') : MERGE_BUTTON}
      </button>
      {reason && !busy ? <p className={`${s.small} ${s.center}`}>{reason}</p> : null}
      {error ? <p className={`${s.note} ${s.noteBad}`} role="alert">{error}</p> : null}
      <JobsPanel jobs={jobs ?? []} active={active} ahead={ahead} alert={alert} failed={failed} userId={staffUserId} personal
        resultsHref={null} listTitle="אימונים קבוצתיים שפתחת" justDone={justDone}
        onRetry={canStart ? () => void start() : undefined} onChanged={refresh} />
      <Link href={`/facilitator/${group.workshop_id}`} className={s.btn}>למצב מדריך של הסדנה</Link>
    </div>
  );
}
