'use client';
import { useCallback, useRef, useState } from 'react';
import { JOB_POLL_MS } from '@/lib/cv/config';
import { fetchQueue, fetchTeamJobs, type QueueEntry, type TrainJob } from '@/lib/cv/jobs';
import { queueAhead } from '@/lib/cv/readiness';
import { reloadStudentContext } from '@/lib/student/context';
import { toast } from '@/lib/store';
import { usePolling } from '@/lib/ws/poll';

const ACTIVE = ['pending', 'running'];

/** The group's recent jobs and the shared queue, refreshed every 15s. Announces a job that just finished. */
export function useTrainJobs(team: string) {
  const [jobs, setJobs] = useState<TrainJob[] | null>(null);
  const [queue, setQueue] = useState<QueueEntry[]>([]);
  const [justDone, setJustDone] = useState<TrainJob | null>(null);
  const seen = useRef(new Map<string, string>());

  const refresh = useCallback(async () => {
    const [list, waiting] = await Promise.all([fetchTeamJobs(team), fetchQueue()]);
    for (const job of list) {
      const before = seen.current.get(job.id);
      if (before && ACTIVE.includes(before) && job.status === 'done') {
        setJustDone(job);
        toast('המודל מוכן. אפשר לראות את התוצאות ולבדוק אותו.', true);
        void reloadStudentContext();
      }
      seen.current.set(job.id, job.status);
    }
    setJobs(list);
    setQueue(waiting);
  }, [team]);

  usePolling(refresh, JOB_POLL_MS);

  const active = jobs?.find((j) => ACTIVE.includes(j.status)) ?? null;
  const ahead = active?.status === 'pending' ? queueAhead(queue, active.id) : null;
  return { jobs, active, ahead, justDone, refresh };
}
