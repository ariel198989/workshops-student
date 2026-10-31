import Link from 'next/link';
import { HugeiconsIcon } from '@hugeicons/react';
import { ArrowLeft01Icon } from '@hugeicons/core-free-icons';
import type { LiveState, StudentCaps, StudentProgress } from '@/lib/student/context';
import { pickHomeStep } from '@/lib/student/live';
import h from './home.module.css';

interface Props {
  progress: StudentProgress | null;
  caps: StudentCaps;
  /** the facilitator's live step wins over the computed next step */
  live?: LiveState | null;
  checksCount?: number;
}

/** The single next thing to do: what the facilitator broadcast, else what the group's progress says. */
export function NextStepCard({ progress, caps, live = null, checksCount = 0 }: Props) {
  const step = pickHomeStep(progress, caps, live, checksCount);
  return (
    <Link href={step.href} className={h.next}>
      <span className={h.nextText}>
        <span className={h.nextLabel}>{live ? 'עכשיו בכיתה' : 'הצעד הבא'}</span>
        <span className={h.nextTitle}>{step.title}</span>
        <span className={h.nextHint}>{step.hint}</span>
      </span>
      <span className={h.nextIcon} aria-hidden="true"><HugeiconsIcon icon={ArrowLeft01Icon} size={24} /></span>
    </Link>
  );
}
