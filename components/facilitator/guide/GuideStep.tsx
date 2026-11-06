'use client';
// המפגש: the facilitator's guide inside מצב מדריך. Picks tonight's session,
// lists its modules as expandable cards, keeps the agenda ticks on this device.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Spinner } from '@/components/ui/Spinner';
import { CONSOLE_URL } from '@/lib/config';
import {
  fmtShortDate, fmtTime, he, parseNotes, pickDefaultSession, safeContent, SESSION_KIND_HE, sessionChipLabel, sessionTotal,
  type ModuleRow, type ParsedNotes, type SessionRow,
} from '@/lib/facilitator/guide';
import { fetchSessionPlan, fetchTemplateStory, type SessionPlan } from '@/lib/facilitator/guide-api';
import { clearLiveStep, fetchLiveState, setLiveStep } from '@/lib/facilitator/live-api';
import { breakArgs, liveLabelOf, liveStepArgs } from '@/lib/facilitator/live-step';
import { openerFor } from '@/lib/facilitator/story';
import { toast } from '@/lib/store';
import {
  agendaId, emptyProgress, loadProgress, nextUndone, resetModule, saveProgress, toggleAgenda, toggleModule, type GuideProgress,
} from '@/lib/facilitator/progress';
import type { AgendaEntry } from './AgendaList';
import { ModuleCard } from './ModuleCard';
import { OpenerBox } from './OpenerBox';
import { itemSeconds, NowBar, type LiveControls } from './NowBar';
import { useCountdown } from './useCountdown';
import { Projector } from './Projector';
import g from './guide.module.css';

interface Prepared { module: ModuleRow; parsed: ParsedNotes; entries: AgendaEntry[] }

function prepare(modules: readonly ModuleRow[]): Prepared[] {
  return modules.map((m) => {
    const parsed = parseNotes(safeContent(m.content).facilitator_notes);
    const entries = parsed.agenda.map((item, index) => ({ id: agendaId(m.id, index), moduleId: m.id, index, item }));
    return { module: m, parsed, entries };
  });
}

function EmptyPlan() {
  return (
    <div className={g.empty}>
      <p className={g.emptyTitle}>לסדנה הזאת עוד אין מפגשים.</p>
      <p className={g.quiet}>בקונסול: סדנה → מפגשים → טעינת תבנית.</p>
      <a className="primary" role="button" href={CONSOLE_URL}>לקונסול</a>
    </div>
  );
}

export function GuideStep({ workshopId }: { workshopId: string }) {
  const [plan, setPlan] = useState<SessionPlan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [progress, setProgress] = useState<GuideProgress>(emptyProgress);
  const [projector, setProjector] = useState(false);
  const [liveLabel, setLiveLabel] = useState<string | null>(null);
  const [liveBusy, setLiveBusy] = useState(false);
  const [story, setStory] = useState<unknown>(null);

  useEffect(() => {
    let alive = true;
    setPlan(null);
    setError(null);
    fetchSessionPlan(workshopId)
      .then((p) => {
        if (!alive) return;
        setPlan(p);
        setSessionId(pickDefaultSession(p.sessions)?.id ?? null);
      })
      .catch(() => { if (alive) { setPlan({ sessions: [], modulesBySession: {} }); setError('לא הצלחנו לטעון את המפגשים.'); } });
    return () => { alive = false; };
  }, [workshopId, tick]);

  useEffect(() => { setProgress(loadProgress(workshopId)); }, [workshopId]);

  // the template's story frame: one opener per session; missing or hidden by RLS = no box
  useEffect(() => {
    let alive = true;
    setStory(null);
    void fetchTemplateStory(workshopId).then((s) => { if (alive) setStory(s); });
    return () => { alive = false; };
  }, [workshopId]);

  // what the students see right now; a failure here is silent (the bar just shows ״לא משודר״)
  useEffect(() => {
    let alive = true;
    fetchLiveState(workshopId)
      .then((row) => { if (alive) setLiveLabel(liveLabelOf(row)); })
      .catch(() => { if (alive) setLiveLabel(null); });
    return () => { alive = false; };
  }, [workshopId]);

  const runLive = useCallback(async (work: () => Promise<string | null>, okText: string) => {
    setLiveBusy(true);
    try {
      setLiveLabel(await work());
      toast(okText, true);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'השידור לכיתה לא הצליח.');
    } finally {
      setLiveBusy(false);
    }
  }, []);

  const onBroadcast = useCallback((entry: AgendaEntry) => {
    void runLive(async () => liveLabelOf(await setLiveStep(liveStepArgs(workshopId, entry.moduleId, entry.item.title))), 'שודר לכיתה');
  }, [runLive, workshopId]);

  const live: LiveControls = useMemo(() => ({
    label: liveLabel,
    busy: liveBusy,
    onBreak: () => void runLive(async () => liveLabelOf(await setLiveStep(breakArgs(workshopId))), 'הכיתה בהפסקה'),
    onClear: () => void runLive(async () => { await clearLiveStep(workshopId); return null; }, 'השידור נוקה'),
  }), [liveLabel, liveBusy, runLive, workshopId]);

  const update = useCallback((next: GuideProgress) => {
    setProgress(next);
    saveProgress(workshopId, next);
  }, [workshopId]);

  const session: SessionRow | null = plan?.sessions.find((s) => s.id === sessionId) ?? null;
  const modules = useMemo(() => (session ? plan?.modulesBySession[session.id] ?? [] : []), [plan, session]);
  const prepared = useMemo(() => prepare(modules), [modules]);
  const allEntries = useMemo(() => prepared.flatMap((p) => p.entries), [prepared]);
  const done = useMemo(() => new Set(progress.agenda), [progress]);
  const now = nextUndone(allEntries, progress);
  const nowModuleId = now?.moduleId ?? null;
  const nowId = now?.id ?? null;

  // one clock for the phone bar and the projector; a new current item gets a fresh one
  const seconds = itemSeconds(now);
  const clock = useCountdown(seconds);
  const { reset } = clock;
  useEffect(() => { reset(seconds); }, [nowId, seconds, reset]);

  // the open card follows the current item when the session changes
  useEffect(() => {
    setOpenId(nowModuleId ?? modules[0]?.id ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, plan]);

  const onToggleAgenda = useCallback((id: string) => update(toggleAgenda(progress, id)), [progress, update]);

  if (plan === null) return <div className={g.center}><Spinner large /></div>;
  if (error) {
    return (
      <div className={g.empty}>
        <p className={g.err} role="alert">{error}</p>
        <button type="button" onClick={() => setTick((t) => t + 1)}>ניסיון נוסף</button>
      </div>
    );
  }
  if (plan.sessions.length === 0 || !session) return <EmptyPlan />;

  const total = sessionTotal(modules);
  const label = sessionChipLabel(session, total);
  const entriesByModule = Object.fromEntries(prepared.map((p) => [p.module.id, p.entries]));
  const doneCount = allEntries.filter((e) => done.has(e.id)).length;
  const opener = openerFor(story, session.session_no);

  return (
    <div className={g.root}>
      <div className={g.chips} role="group" aria-label="מפגשים">
        {plan.sessions.map((s) => {
          const on = s.id === session.id;
          const mods = plan.modulesBySession[s.id] ?? [];
          const date = fmtShortDate(s.scheduled_at);
          return (
            <button key={s.id} type="button" aria-pressed={on} className={`${g.chip} ${on ? g.chipOn : ''}`} onClick={() => setSessionId(s.id)}>
              <span className={g.chipLabel}>{sessionChipLabel(s, sessionTotal(mods))}</span>
              {date ? <span className={g.chipDate} dir="ltr">{date}</span> : null}
            </button>
          );
        })}
      </div>

      <div className={g.meta}>
        <span className={g.metaMain}>
          {session.scheduled_at ? <span dir="ltr">{fmtShortDate(session.scheduled_at)} · {fmtTime(session.scheduled_at)}</span> : <span>ללא תאריך</span>}
          {he(SESSION_KIND_HE, session.kind) ? <span className={g.tag}>{he(SESSION_KIND_HE, session.kind)}</span> : null}
          <span className={g.quiet}>{modules.length === 1 ? 'מודול אחד' : `${modules.length} מודולים`}{allEntries.length > 0 ? ` · ${doneCount}/${allEntries.length} פריטים` : ''}</span>
        </span>
        <button type="button" className={g.projToggle} aria-pressed={projector} disabled={modules.length === 0} onClick={() => setProjector(true)}>מקרן</button>
      </div>

      {opener ? <OpenerBox opener={opener} /> : null}

      {modules.length === 0 ? (
        <p className={g.quiet}>למפגש הזה עוד אין מודולים. בקונסול: מפגשים → טעינת תבנית.</p>
      ) : (
        <div className={g.cards}>
          {prepared.map((p) => (
            <ModuleCard key={p.module.id} module={p.module} parsed={p.parsed} entries={p.entries} open={openId === p.module.id}
              moduleDone={progress.modules.includes(p.module.id)} done={done} nowId={now?.id ?? null}
              onOpen={() => setOpenId(openId === p.module.id ? null : p.module.id)}
              onToggleAgenda={onToggleAgenda}
              onToggleModule={() => update(toggleModule(progress, p.module.id))}
              onReset={() => update(resetModule(progress, p.module.id))}
              liveLabel={liveLabel} onBroadcast={onBroadcast} />
          ))}
        </div>
      )}

      {modules.length > 0 ? <NowBar now={now} clock={clock} total={allEntries.length} doneCount={doneCount} onDone={onToggleAgenda} live={live} /> : null}

      {projector ? (
        <Projector sessionLabel={label} modules={modules} entriesByModule={entriesByModule} done={done} now={now} clock={clock}
          initialModuleId={nowModuleId ?? openId} onToggle={onToggleAgenda} onExit={() => setProjector(false)}
          live={live} onBroadcast={onBroadcast} />
      ) : null}
    </div>
  );
}
