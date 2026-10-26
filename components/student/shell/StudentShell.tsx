'use client';
import type { ReactNode } from 'react';
import { useStore } from '@/lib/store';
import { groupChip } from '@/lib/student/labels';
import { useStudentContext } from '@/lib/student/context';
import { wsAuthStore } from '@/lib/ws/staff';
import { BottomNav } from './BottomNav';
import { CapsGuard } from './CapsGuard';
import { TopBar } from './TopBar';
import s from './shell.module.css';

/** Phone-first frame for every student page: top bar, content, bottom nav (once the student is in a workshop). */
export function StudentShell({ children }: { children: ReactNode }) {
  const { ctx } = useStudentContext();
  const { whoami } = useStore(wsAuthStore);
  return (
    <div className={s.root}>
      <TopBar workshop={ctx?.workshop.title ?? ''} chip={groupChip(ctx?.group ?? null)} isStaff={!!whoami?.staff} />
      <main className={ctx ? s.main : `${s.main} ${s.mainBare}`}>
        <CapsGuard ctx={ctx}>{children}</CapsGuard>
      </main>
      {ctx ? <BottomNav caps={ctx.caps} checksCount={ctx.checks.length} /> : null}
    </div>
  );
}
