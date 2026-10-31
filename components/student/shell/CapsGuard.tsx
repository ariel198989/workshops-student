'use client';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
import { Spinner } from '@/components/ui/Spinner';
import { decideRoute } from '@/lib/student/access';
import type { StudentContext } from '@/lib/student/context';
import { decideLiveRoute } from '@/lib/student/live';
import { showHomeNotice } from '@/lib/student/notice';
import s from './shell.module.css';

/** Why this student may not be on this path right now: the workshop's caps first, then the facilitator's live step. */
function blockedBy(ctx: StudentContext | null, pathname: string | null): string | null {
  if (!ctx) return null;
  const caps = decideRoute(pathname, ctx.caps, ctx.checks.length);
  if (!caps.allowed) return caps.reason;
  const live = decideLiveRoute(pathname, ctx.live);
  return live.allowed ? null : live.reason;
}

/**
 * Runs inside the student shell once the context is loaded: a step this workshop leaves to the facilitator
 * (per ctx.caps), or one the facilitator has not opened yet (ctx.live), sends the student home with a
 * one-line banner saying why.
 */
export function CapsGuard({ ctx, children }: { ctx: StudentContext | null; children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const reason = blockedBy(ctx, pathname);

  useEffect(() => {
    if (!reason) return;
    showHomeNotice(reason);
    router.replace('/');
  }, [reason, router]);

  if (reason) return <div className={s.guardSpin}><Spinner large /></div>;
  return <>{children}</>;
}
