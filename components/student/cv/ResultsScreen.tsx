'use client';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { Spinner } from '@/components/ui/Spinner';
import { friendlyError } from '@/lib/cv/capture-utils';
import type { Engine } from '@/lib/cv/infer';
import { fetchModelPick, type TeamModel } from '@/lib/cv/model';
import type { StudentCaps } from '@/lib/student/caps';
import { scopeOf } from '@/lib/student/context';
import { formatMetric } from '@/lib/student/metric';
import { markResultsSeen } from '@/lib/student/results-seen';
import { ClassStatsList } from './ClassStatsList';
import { LiveTest } from './LiveTest';
import { ModelCard } from './ModelCard';
import { TestPanel } from './TestPanel';
import { useEngine } from './useEngine';
import type { CvSession } from './CvGate';
import s from './cv.module.css';

function noModelLead(caps: StudentCaps, personal: boolean): string {
  if (personal) return 'עוד אין לך מודל. אחרי האימון הראשון הוא יופיע כאן, וגם אפשר יהיה לבדוק אותו במצלמה.';
  return caps.can_train
    ? 'המודל נולד באימון: מצלמים, מסמנים תיבות, ושולחים לאימון בענן. כשהאימון מסתיים, המודל מופיע כאן וגם אפשר לבדוק אותו במצלמה.'
    : 'המודל נולד באימון: מצלמים, מסמנים, והמדריך שולח לאימון בענן. כשהאימון מסתיים, המודל מופיע כאן וגם אפשר לבדוק אותו במצלמה.';
}

function NoModel({ caps, personal }: { caps: StudentCaps; personal: boolean }) {
  return (
    <div className={`${s.card} ${s.stack}`}>
      <h2 className={s.h2}>{personal ? 'עוד אין לך מודל' : 'עוד אין מודל לקבוצה'}</h2>
      <p className={s.lead}>{noModelLead(caps, personal)}</p>
      {caps.can_train ? <Link href="/train" className={`${s.btn} ${s.btnPrimary}`}>לאימון</Link> : null}
      {caps.can_capture ? (
        <Link href="/capture" className={caps.can_train ? s.btn : `${s.btn} ${s.btnPrimary}`}>לצילום</Link>
      ) : null}
    </div>
  );
}

interface GroupModelProps { model: TeamModel; caps: StudentCaps; loadingEngine: boolean; onLive: () => void; open: boolean }

/**
 * Personal scope: the group's model (scope 'group', e.g. merged by the facilitator from everyone's photos).
 * Beside my own model it is folded under a quiet heading; with no model of mine it is shown open, alone.
 */
function GroupModel({ model, caps, loadingEngine, onLive, open }: GroupModelProps) {
  return (
    <details className={s.fold} open={open}>
      <summary className={s.foldHead}>המודל של הקבוצה</summary>
      <div className={s.stack}>
        <ModelCard model={model} mode={caps.metric_mode} canCapture={caps.can_capture} />
        <ClassStatsList view={formatMetric(caps.metric_mode, model)} canCapture={caps.can_capture} />
        <button type="button" className={s.btn} disabled={loadingEngine} onClick={onLive}>
          {loadingEngine ? 'טוענים מודל' : 'בדיקת המודל של הקבוצה במצלמה'}
        </button>
      </div>
    </details>
  );
}

/** Results: my model (personal scope) or the group's, honest quality in the band's language, per-object scores, live testing. */
export function ResultsScreen({ session }: { session: CvSession }) {
  const { team, userId, ctx } = session;
  const { caps } = ctx;
  const { personal } = scopeOf(ctx);
  const [model, setModel] = useState<TeamModel | null | undefined>(undefined);
  const [group, setGroup] = useState<TeamModel | null>(null);
  const [error, setError] = useState('');
  const [live, setLive] = useState<Engine | null>(null);
  // which model the one engine holds: mine by default, the group's while its live test is asked for
  const [target, setTarget] = useState<TeamModel | null>(null);
  const [wantLive, setWantLive] = useState(false);
  // changes when a training run finishes: the group's newest model, and my own model count
  const modelKey = `${ctx.progress?.model?.id ?? ''}|${ctx.mine.models}`;
  const shown = target ?? model ?? group;
  const engine = useEngine(shown);
  const loadingEngine = engine.status === 'loading';
  const loadingGroup = loadingEngine && !!group && shown === group;

  const load = useCallback(async () => {
    setError('');
    try {
      const pick = await fetchModelPick(userId, team, personal);
      setModel(pick.model);
      setGroup(pick.group);
    } catch (e) {
      setError(friendlyError(e, 'לא הצלחנו לטעון את המודל. בדקו את החיבור.'));
      setModel(null);
    }
  }, [userId, team, personal]);

  useEffect(() => { void load(); }, [load, modelKey]);
  // the stepper ticks "results" once the team has looked at its model
  useEffect(() => { if (model) markResultsSeen(team); }, [model, team]);

  const openLive = async () => { setLive(await engine.ensure()); };
  const { ensure } = engine;
  // a target switch re-binds ensure to the other model on the next render; open the live test then
  useEffect(() => {
    if (!wantLive) return;
    setWantLive(false);
    void ensure().then(setLive);
  }, [wantLive, ensure]);
  const openGroupLive = () => { setTarget(group); setWantLive(true); };
  const closeLive = () => { setLive(null); setTarget(null); };

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
          <button type="button" className={`${s.btn} ${s.btnPrimary}`} disabled={loadingEngine} onClick={() => void openLive()}>
            {loadingEngine ? 'טוענים מודל' : 'בדיקה במצלמה חיה'}
          </button>
          <ModelCard model={model} mode={caps.metric_mode} canCapture={caps.can_capture} title={personal ? 'המודל שלי' : undefined} />
          <ClassStatsList view={formatMetric(caps.metric_mode, model)} canCapture={caps.can_capture} />
          <TestPanel status={engine.status} error={engine.error} ensure={engine.ensure} onLive={openLive} />
          {caps.can_capture ? <Link href="/capture" className={s.btn}>חזרה לצילום: עוד תמונות לשיפור</Link> : null}
          {group ? <GroupModel model={group} caps={caps} loadingEngine={loadingGroup} onLive={openGroupLive} open={false} /> : null}
        </>
      ) : !error ? (
        <>
          <NoModel caps={caps} personal={personal} />
          {group ? <GroupModel model={group} caps={caps} loadingEngine={loadingGroup} onLive={openGroupLive} open /> : null}
        </>
      ) : null}
      {live ? <LiveTest engine={live} onClose={closeLive} /> : null}
    </div>
  );
}
