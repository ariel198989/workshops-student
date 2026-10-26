'use client';
// One module of the session: a large card that expands in place with the full
// content (summary, objectives, agenda checklist, exercises, materials, notes).
import {
  he, KIND_HE, minutesHe, parseSteps, STAGE_HE, TYPE_HE, type Exercise, type ModuleRow, type ParsedNotes,
} from '@/lib/facilitator/guide';
import { safeContent } from '@/lib/facilitator/guide';
import { AgendaList, type AgendaEntry } from './AgendaList';
import { Tpl } from './Tpl';
import g from './guide.module.css';

interface Props {
  module: ModuleRow;
  parsed: ParsedNotes;
  entries: AgendaEntry[];
  open: boolean;
  moduleDone: boolean;
  done: ReadonlySet<string>;
  nowId: string | null;
  onOpen: () => void;
  onToggleAgenda: (id: string) => void;
  onToggleModule: () => void;
  onReset: () => void;
}

function Lines({ text }: { text: string }) {
  return (
    <>
      {text.split(/\r?\n/).filter((l) => l.trim()).map((l, i) => <p key={i}><Tpl text={l} /></p>)}
    </>
  );
}

function ExerciseBlock({ ex }: { ex: Exercise }) {
  const steps = parseSteps(ex.instructions);
  return (
    <div className={g.exercise}>
      <div className={g.exHead}>
        <span className={g.exTitle}><Tpl text={ex.title || 'תרגיל'} /></span>
        {he(KIND_HE, ex.kind) ? <span className={g.tag}>{he(KIND_HE, ex.kind)}</span> : null}
        {ex.tool_hook && ex.tool_hook !== 'none' ? <span className={`${g.tag} ${g.tagTool}`} dir="ltr">{ex.tool_hook}</span> : null}
      </div>
      {steps.length > 0 ? (
        <ol className={g.steps}>{steps.map((s, i) => <li key={i}><Tpl text={s} /></li>)}</ol>
      ) : null}
      {ex.questions && ex.questions.length > 0 ? (
        <table className={g.qTable}>
          <thead><tr><th>שאלה</th><th>אפשרויות</th></tr></thead>
          <tbody>
            {ex.questions.map((q, i) => (
              <tr key={i}>
                <td>
                  <Tpl text={q.q} />
                  {q.core ? <span className={`${g.tag} ${g.tagCore}`}>ליבה</span> : null}
                </td>
                <td>
                  <ul className={g.options}>
                    {q.options.map((o, j) => (
                      <li key={j} className={o === q.answer ? g.qCorrect : ''}>
                        {o === q.answer ? <span aria-label="התשובה הנכונה">✓ </span> : null}{o}
                      </li>
                    ))}
                    {q.answer && !q.options.includes(q.answer) ? <li className={g.qCorrect}>✓ {q.answer}</li> : null}
                  </ul>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
    </div>
  );
}

export function ModuleCard({ module: m, parsed, entries, open, moduleDone, done, nowId, onOpen, onToggleAgenda, onToggleModule, onReset }: Props) {
  const c = safeContent(m.content);
  const type = he(TYPE_HE, m.module_type);
  const stage = he(STAGE_HE, m.pipeline_stage);
  const ticked = entries.filter((e) => done.has(e.id)).length;
  const bodyId = `guide-mod-${m.id}`;
  const hasNow = entries.some((e) => e.id === nowId);

  return (
    <article className={`${g.card} ${open ? g.cardOpen : ''} ${moduleDone ? g.cardDone : ''} ${hasNow && !open ? g.cardNow : ''}`}>
      <button type="button" className={g.cardHead} aria-expanded={open} aria-controls={bodyId} onClick={onOpen}>
        <span className={g.pos} aria-label={`מודול ${m.position}`}>{m.position}</span>
        <span className={g.cardMain}>
          <span className={g.cardTitle}><Tpl text={m.title ?? 'מודול'} /></span>
          <span className={g.cardMeta}>
            {m.duration_minutes ? <span className={g.dur}>{minutesHe(m.duration_minutes)}</span> : null}
            {type ? <span className={g.tag}>{type}</span> : null}
            {stage ? <span className={`${g.tag} ${g.tagStage}`}>{stage}</span> : null}
            {entries.length > 0 ? <span className={g.progress}>{ticked}/{entries.length}</span> : null}
            {moduleDone ? <span className={`${g.tag} ${g.tagDone}`}>הושלם</span> : null}
          </span>
        </span>
        <svg className={g.chev} viewBox="0 0 24 24" width="28" height="28" aria-hidden><path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </button>

      {open ? (
        <div id={bodyId} className={g.body}>
          {c.summary ? <p className={g.summary}><Tpl text={c.summary} /></p> : null}

          {c.objectives.length > 0 ? (
            <section className={g.section}>
              <h3 className={g.sectionTitle}>מטרות</h3>
              <ul className={g.bullets}>{c.objectives.map((o, i) => <li key={i}><Tpl text={o} /></li>)}</ul>
            </section>
          ) : null}

          <section className={g.section}>
            <h3 className={g.sectionTitle}>סדר יום</h3>
            <AgendaList entries={entries} done={done} nowId={nowId} onToggle={onToggleAgenda} />
          </section>

          {c.exercises.length > 0 ? (
            <section className={g.section}>
              <h3 className={g.sectionTitle}>תרגילים</h3>
              <div className={g.exercises}>{c.exercises.map((ex, i) => <ExerciseBlock key={i} ex={ex} />)}</div>
            </section>
          ) : null}

          {c.materials.length > 0 ? (
            <section className={g.section}>
              <h3 className={g.sectionTitle}>חומרים</h3>
              <div className={g.materials}>{c.materials.map((mat, i) => <span key={i} className={g.mat}>{mat.label}</span>)}</div>
            </section>
          ) : null}

          {parsed.notes ? (
            <section className={g.section}>
              <h3 className={g.sectionTitle}>למדריך</h3>
              <div className={g.notes}><Lines text={parsed.notes} /></div>
            </section>
          ) : null}

          {parsed.assessment ? (
            <section className={g.section}>
              <h3 className={g.sectionTitle}>הערכה</h3>
              <div className={g.notes}><Lines text={parsed.assessment} /></div>
            </section>
          ) : null}

          {parsed.adaptations.easier || parsed.adaptations.harder || parsed.adaptations.raw ? (
            <section className={g.section}>
              <h3 className={g.sectionTitle}>התאמות</h3>
              <div className={g.adapt}>
                {parsed.adaptations.easier ? <div className={g.adaptCol}><span className={g.adaptLabel}>קל יותר</span><p><Tpl text={parsed.adaptations.easier} /></p></div> : null}
                {parsed.adaptations.harder ? <div className={g.adaptCol}><span className={g.adaptLabel}>מאתגר יותר</span><p><Tpl text={parsed.adaptations.harder} /></p></div> : null}
                {!parsed.adaptations.easier && !parsed.adaptations.harder ? <div className={g.adaptCol}><Lines text={parsed.adaptations.raw} /></div> : null}
              </div>
            </section>
          ) : null}

          {c.template_notes ? (
            <section className={g.section}>
              <h3 className={g.sectionTitle}>מהתבנית</h3>
              <div className={`${g.notes} ${g.quiet}`}><Lines text={c.template_notes} /></div>
            </section>
          ) : null}

          <div className={g.cardActions}>
            <button type="button" className={moduleDone ? '' : 'primary'} aria-pressed={moduleDone} onClick={onToggleModule}>
              {moduleDone ? 'המודול הושלם ✓' : 'סיימנו את המודול'}
            </button>
            {ticked > 0 || moduleDone ? <button type="button" className="ghost" onClick={onReset}>איפוס סימונים</button> : null}
          </div>
        </div>
      ) : null}
    </article>
  );
}
