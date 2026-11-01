'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { MouseEvent } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import { ArrowLeft01Icon, Tick02Icon } from '@hugeicons/core-free-icons';
import { toast } from '@/lib/store';
import { scopeOf, teamOf, type StudentContext } from '@/lib/student/context';
import { flowProgressOf, flowSteps, type FlowStep } from '@/lib/student/flow';
import { liveBlockedReason } from '@/lib/student/live';
import { useResultsSeen } from '@/lib/student/results-seen';
import s from './shell.module.css';

function stepName(st: FlowStep): string {
  const state = !st.open ? 'סגור כרגע' : st.done ? 'הושלם' : st.next ? 'השלב הבא' : null;
  return state ? `${st.label}, ${state}` : st.label;
}

function Dot({ st, index }: { st: FlowStep; index: number }) {
  if (st.done) return <HugeiconsIcon icon={Tick02Icon} size={14} strokeWidth={2.5} />;
  if (st.next) return <HugeiconsIcon icon={ArrowLeft01Icon} size={14} strokeWidth={2.5} />;
  return <>{index + 1}</>;
}

/** Slim stepper under the live bar: the gated steps this workshop opens, ticked from progress, the current one lit. */
export function FlowStepper({ ctx }: { ctx: StudentContext }) {
  const pathname = usePathname();
  const resultsSeen = useResultsSeen(teamOf(ctx));
  const mine = scopeOf(ctx).personal ? ctx.mine : null; // personal pool scope: the ticks follow my own counts
  const steps = flowSteps(ctx.caps, flowProgressOf(ctx.progress, !!ctx.certificate, resultsSeen, mine), ctx.live, pathname);
  if (steps.length === 0) return null;
  const hold = (e: MouseEvent) => {
    e.preventDefault();
    if (ctx.live) toast(liveBlockedReason(ctx.live), true);
  };
  return (
    <nav className={s.flow} aria-label="שלבי הפעילות">
      <ol className={s.flowList}>
        {steps.map((st, i) => {
          const cls = [
            s.flowStep, st.done ? s.flowDone : '', st.current ? s.flowCur : '', st.next ? s.flowNext : '', st.open ? '' : s.flowOff,
          ].filter(Boolean).join(' ');
          return (
            <li key={st.id} className={s.flowItem}>
              {i > 0 ? <span className={st.done || steps[i - 1].done ? `${s.flowSep} ${s.flowSepDone}` : s.flowSep} aria-hidden /> : null}
              <Link href={st.href} className={cls} aria-label={stepName(st)}
                aria-current={st.current ? 'step' : undefined}
                aria-disabled={st.open ? undefined : true}
                tabIndex={st.open ? undefined : -1}
                onClick={st.open ? undefined : hold}>
                <span className={s.flowDot} aria-hidden><Dot st={st} index={i} /></span>
                <span className={s.flowLabel}>{st.label}</span>
              </Link>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
