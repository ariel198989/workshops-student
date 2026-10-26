'use client';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
import { Spinner } from '@/components/ui/Spinner';
import { decideRoute } from '@/lib/student/access';
import type { StudentContext } from '@/lib/student/context';
import { showHomeNotice } from '@/lib/student/notice';
import s from './shell.module.css';

/**
 * Runs inside the student shell once the context is loaded: a step this workshop leaves to the facilitator
 * (per ctx.caps) sends the student home with a one-line banner saying who does it instead.
 */
export function CapsGuard({ ctx, children }: { ctx: StudentContext | null; children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const decision = ctx ? decideRoute(pathname, ctx.caps, ctx.checks.length) : { allowed: true as const };
  const reason = decision.allowed ? null : decision.reason;

  useEffect(() => {
    if (!reason) return;
    showHomeNotice(reason);
    router.replace('/');
  }, [reason, router]);

  if (reason) return <div className={s.guardSpin}><Spinner large /></div>;
  return <>{children}</>;
}
