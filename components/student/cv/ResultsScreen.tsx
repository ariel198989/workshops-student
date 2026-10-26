'use client';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { Spinner } from '@/components/ui/Spinner';
import { friendlyError } from '@/lib/cv/capture-utils';
import { fetchBestTeamModel, type TeamModel } from '@/lib/cv/model';
import type { StudentCaps } from '@/lib/student/caps';
import { formatMetric } from '@/lib/student/metric';
import { ClassStatsList } from './ClassStatsList';
import { ModelCard } from './ModelCard';
import { TestPanel } from './TestPanel';
import { useEngine } from './useEngine';
import type { CvSession } from './CvGate';
import s from './cv.module.css';

function NoModel({ caps }: { caps: StudentCaps }) {
  return (
    <div className={`${s.card} ${s.stack}`}>
      <h2 className={s.h2}>עוד אין מודל לקבוצה</h2>
      <p className={s.lead}>
        {caps.can_train
          ? 'המודל נולד באימון: מצלמים, מסמנים תיבות, ושולחים לאימון בענן. כשהאימון מסתיים, המודל מופיע כאן וגם אפשר לבדוק אותו במצלמה.'
          : 'המודל נולד באימון: מצלמים, מסמנים, והמדריך שולח לאימון בענן. כשהאימון מסתיים, המודל מופיע כאן וגם אפשר לבדוק אותו במצלמה.'}
      </p>
      {caps.can_train ? <Link href="/train" className={`${s.btn} ${s.btnPrimary}`}>לאימון</Link> : null}
      {caps.can_capture ? (
        <Link href="/capture" className={caps.can_train ? s.btn : `${s.btn} ${s.btnPrimary}`}>לצילום</Link>
      ) : null}
    </div>
  );
}

/** Results: the group's best model, honest quality in the band's language, per-object scores, and live testing. */
export function ResultsScreen({ session }: { session: CvSession }) {
  const { team, userId, ctx } = session;
  const { caps } = ctx;
  const [model, setModel] = useState<TeamModel | null | undefined>(undefined);
  const [error, setError] = useState('');
  const modelId = ctx.progress?.model?.id ?? null; // changes when a training run finishes
  const engine = useEngine(model ?? null);

  const load = useCallback(async () => {
    setError('');
    try {
      setModel(await fetchBestTeamModel(userId, team));
    } catch (e) {
      setError(friendlyError(e, 'לא הצלחנו לטעון את המודל. בדקו את החיבור.'));
      setModel(null);
    }
  }, [userId, team]);

  useEffect(() => { void load(); }, [load, modelId]);

  if (model === undefined) return <div className={s.spin}><Spinner large /></div>;
  return (
    <div className={s.stack}>
      <h1 className={s.h1}>תוצאות</h1>
      {error ? (
        <div className={`${s.note} ${s.noteBad}`} role="alert">
          {error}
          <button type="button" className={`${s.btn} ${s.btnSm}`} style={{ marginTop: 8 }} onClick={() => void load()}>ניסיון נוסף</button>
        </div>
      ) : null}
      {model ? (
        <>
          <ModelCard model={model} mode={caps.metric_mode} canCapture={caps.can_capture} />
          <ClassStatsList view={formatMetric(caps.metric_mode, model)} canCapture={caps.can_capture} />
          <TestPanel status={engine.status} error={engine.error} ensure={engine.ensure} />
        </>
      ) : !error ? <NoModel caps={caps} /> : null}
    </div>
  );
}
