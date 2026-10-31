'use client';
import type { ReactNode } from 'react';
import { useStore } from '@/lib/store';
import { groupChip } from '@/lib/student/labels';
import { useStudentContext } from '@/lib/student/context';
import { useLiveState } from '@/lib/student/live-sync';
import { wsAuthStore } from '@/lib/ws/staff';
import { BottomNav } from './BottomNav';
import { CapsGuard } from './CapsGuard';
import { LiveBar } from './LiveBar';
import { TopBar } from './TopBar';
import s from './shell.module.css';

/** Phone-first frame for every student page: top bar, live bar, content, bottom nav (once the student is in a workshop). */
export function StudentShell({ children }: { children: ReactNode }) {
  const { ctx } = useStudentContext();
  const { whoami } = useStore(wsAuthStore);
  useLiveState(ctx?.workshop.id ?? null);
  return (
    <div className={s.root}>
      <TopBar workshop={ctx?.workshop.title ?? ''} chip={groupChip(ctx?.group ?? null)} isStaff={!!whoami?.staff} />
      <LiveBar live={ctx?.live ?? null} />
      <main className={ctx ? s.main : `${s.main} ${s.mainBare}`}>
        <CapsGuard ctx={ctx}>{children}</CapsGuard>
      </main>
      {ctx ? <BottomNav caps={ctx.caps} checksCount={ctx.checks.length} live={ctx.live} /> : null}
    </div>
  );
}
