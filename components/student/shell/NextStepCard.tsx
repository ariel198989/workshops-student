import Link from 'next/link';
import { HugeiconsIcon } from '@hugeicons/react';
import { ArrowLeft01Icon } from '@hugeicons/core-free-icons';
import type { StudentProgress } from '@/lib/student/context';
import { pickNextStep } from '@/lib/student/next-step';
import h from './home.module.css';

/** The single next thing to do, chosen from the group's progress. */
export function NextStepCard({ progress }: { progress: StudentProgress | null }) {
  const step = pickNextStep(progress);
  return (
    <Link href={step.href} className={h.next}>
      <span className={h.nextText}>
        <span className={h.nextLabel}>הצעד הבא</span>
        <span className={h.nextTitle}>{step.title}</span>
        <span className={h.nextHint}>{step.hint}</span>
      </span>
      <span className={h.nextIcon} aria-hidden="true"><HugeiconsIcon icon={ArrowLeft01Icon} size={24} /></span>
    </Link>
  );
}
