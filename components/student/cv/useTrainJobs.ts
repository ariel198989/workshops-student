'use client';
import { useCallback, useRef, useState } from 'react';
import { JOB_POLL_MS } from '@/lib/cv/config';
import { fetchQueue, fetchTeamJobs, type QueueEntry, type TrainJob } from '@/lib/cv/jobs';
import { activeJobOf, failedLabel, jobAlert, jobFailureReason, queueAhead, type JobAlert } from '@/lib/cv/readiness';
import { reloadStudentContext } from '@/lib/student/context';
import { toast } from '@/lib/store';
import { usePolling } from '@/lib/ws/poll';

const ACTIVE = ['pending', 'running'];

export interface TrainJobsView {
  /** the group's recent jobs, or only mine in personal scope */
  jobs: TrainJob[] | null;
  /** the pending or running job that blocks a new one: the group's, or only mine in personal scope */
  active: TrainJob | null;
  /** pending jobs of anyone ahead of ours; null unless ours is pending */
  ahead: number | null;
  /** the active job has waited too long (trainer down / run stuck); null while the wait is normal */
  alert: JobAlert | null;
  /** the group's latest job when it failed and nothing newer is active */
  failed: TrainJob | null;
  justDone: TrainJob | null;
  refresh: () => Promise<void>;
}

/**
 * Recent jobs (the group's, or only the ones `me` requested in personal scope) and the shared queue,
 * refreshed every 15s. Announces a job that just finished or failed.
 */
export function useTrainJobs(
  team: string, me: string | null, opts: { reloadContext?: boolean } = {},
): TrainJobsView {
  // staff pages have no student context: a finished job must not call ws_my_context for them
  const reloadContext = opts.reloadContext ?? true;
  const [jobs, setJobs] = useState<TrainJob[] | null>(null);
  const [queue, setQueue] = useState<QueueEntry[]>([]);
  const [justDone, setJustDone] = useState<TrainJob | null>(null);
  const seen = useRef(new Map<string, string>());

  const refresh = useCallback(async () => {
    const [list, waiting] = await Promise.all([fetchTeamJobs(team, me), fetchQueue()]);
    for (const job of list) {
      const before = seen.current.get(job.id);
      const wasActive = !!before && ACTIVE.includes(before);
      if (wasActive && job.status === 'done') {
        setJustDone(job);
        toast('המודל מוכן. אפשר לראות את התוצאות ולבדוק אותו.', true);
        if (reloadContext) void reloadStudentContext();
      } else if (wasActive && job.status === 'failed') {
        toast(failedLabel(jobFailureReason(job)));
      }
      seen.current.set(job.id, job.status);
    }
    setJobs(list);
    setQueue(waiting);
  }, [team, me, reloadContext]);

  usePolling(refresh, JOB_POLL_MS);

  const active = jobs ? activeJobOf(jobs, me) : null;
  const ahead = active?.status === 'pending' ? queueAhead(queue, active.id) : null;
  const alert = active ? jobAlert(active, queue, Date.now()) : null;
  const latest = jobs?.[0] ?? null;
  const failed = !active && latest?.status === 'failed' ? latest : null;
  return { jobs, active, ahead, alert, failed, justDone, refresh };
}
