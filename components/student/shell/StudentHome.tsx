'use client';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import { RefreshIcon } from '@hugeicons/core-free-icons';
import { Spinner } from '@/components/ui/Spinner';
import { progressForScope, scopeOf, useStudentContext } from '@/lib/student/context';
import { shownName } from '@/lib/student/device-account';
import { firstName } from '@/lib/student/labels';
import { CertificateTeaser } from './CertificateTeaser';
import { HomeBanner } from './HomeBanner';
import { MissionCard } from './MissionCard';
import { NextStepCard } from './NextStepCard';
import { ProgressCard } from './ProgressCard';
import { ScheduleCard } from './ScheduleCard';
import { TeamCard } from './TeamCard';
import k from './kit.module.css';
import h from './home.module.css';

function Notice({ title, text, action }: { title: string; text: string; action: ReactNode }) {
  return (
    <div className={`${k.card} ${k.center} ${k.stack}`}>
      <h1 className={k.h2}>{title}</h1>
      <p className={k.lead}>{text}</p>
      {action}
    </div>
  );
}

/** /: greeting, next step, mission, progress, team, schedule, certificate. One RPC feeds all of it. */
export function StudentHome() {
  const { ctx, loading, loaded, error, reload } = useStudentContext();

  if (!loaded) return <div className={k.spin}><Spinner large /></div>;
  if (error && !ctx) {
    return (
      <Notice title="לא הצלחנו לטעון" text="בדקו את החיבור לאינטרנט ונסו שוב."
        action={<button type="button" className={`${k.btn} ${k.btnPrimary}`} onClick={() => void reload()}>ניסיון נוסף</button>} />
    );
  }
  if (!ctx) {
    return (
      <Notice title="עוד לא הצטרפתם לסדנה" text="כדי להתחיל צריך את הקוד מהמדריך."
        action={<Link href="/join" className={`${k.btn} ${k.btnPrimary}`}>הצטרפות עם קוד</Link>} />
    );
  }
  const name = firstName(shownName(ctx.me.full_name)); // a device account's placeholder is never a greeting
  const scope = scopeOf(ctx);
  const mine = scope.personal ? ctx.mine : null; // personal pool scope: the home speaks about my own photos and model
  return (
    <div className={k.stack}>
      <div className={h.greetRow}>
        <h1 className={k.h1}>{name ? `שלום ${name}` : 'שלום'}</h1>
        <button type="button" className={loading ? `${h.refresh} ${h.spinning}` : h.refresh}
          onClick={() => void reload()} disabled={loading} aria-label="רענון">
          <HugeiconsIcon icon={RefreshIcon} size={22} />
        </button>
      </div>
      <HomeBanner />
      <NextStepCard progress={progressForScope(scope, ctx.progress, ctx.mine)} caps={ctx.caps} live={ctx.live} checksCount={ctx.checks.length}
        team={ctx.group?.team_name ?? null} certificate={!!ctx.certificate} />
      {ctx.certificate ? <CertificateTeaser /> : null}
      <MissionCard ctx={ctx} />
      <ProgressCard progress={ctx.progress} mine={mine} />
      <TeamCard ctx={ctx} />
      <ScheduleCard sessions={ctx.sessions} />
    </div>
  );
}
