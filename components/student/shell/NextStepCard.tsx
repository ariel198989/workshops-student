'use client';
import Link from 'next/link';
import { useEffect } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import { ArrowLeft01Icon } from '@hugeicons/core-free-icons';
import type { LiveState, StudentCaps, StudentProgress } from '@/lib/student/context';
import { startFaceGuard } from '@/lib/cv/face-detector';
import { prefetchesGuard } from '@/lib/cv/face-guard';
import { flowCta, flowProgressOf, flowSteps } from '@/lib/student/flow';
import { pickHomeStep } from '@/lib/student/live';
import { useResultsSeen } from '@/lib/student/results-seen';
import h from './home.module.css';

interface Props {
  progress: StudentProgress | null;
  caps: StudentCaps;
  /** the facilitator's live step wins over the computed next step */
  live?: LiveState | null;
  checksCount?: number;
  /** the group's data key; lets the button speak in the stepper's words ("לשלב הבא: תיוג") */
  team?: string | null;
  certificate?: boolean;
}

/** The single next thing to do: what the facilitator broadcast, else what the group's progress says. */
export function NextStepCard({ progress, caps, live = null, checksCount = 0, team = null, certificate = false }: Props) {
  const step = pickHomeStep(progress, caps, live, checksCount);
  const resultsSeen = useResultsSeen(team);
  const cta = flowCta(flowSteps(caps, flowProgressOf(progress, certificate, resultsSeen), live, '/'), step.href);
  // capture is next: fetch the privacy guard now, so the shutter is ready when the camera opens
  useEffect(() => { if (prefetchesGuard(step.href)) startFaceGuard(); }, [step.href]);
  return (
    <Link href={step.href} className={h.next}>
      <span className={h.nextText}>
        <span className={h.nextLabel}>{live ? 'עכשיו בכיתה' : 'הצעד הבא'}</span>
        <span className={h.nextTitle}>{step.title}</span>
        <span className={h.nextHint}>{step.hint}</span>
        {cta ? <span className={h.nextCta}>{cta}</span> : null}
      </span>
      <span className={h.nextIcon} aria-hidden="true"><HugeiconsIcon icon={ArrowLeft01Icon} size={24} /></span>
    </Link>
  );
}
