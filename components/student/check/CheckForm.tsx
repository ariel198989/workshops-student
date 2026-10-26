'use client';
import { useState } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import { CheckmarkCircle02Icon } from '@hugeicons/core-free-icons';
import {
  PHASE_LABEL, SCALE_MAX, THANKS, buildAnswers, isComplete, isScale, optionLetter, phasesOf,
  type CheckPhase, type ConceptCheck, type ConceptQuestion,
} from '@/lib/student/concept';
import { isPhaseLocked, lockPhase, submitConceptCheck } from '@/lib/student/concept-api';
import k from '@/components/student/shell/kit.module.css';
import c from './check.module.css';

const PHASE_SUB: Record<CheckPhase, string> = { pre: 'לפני הפעילות', post: 'אחרי הפעילות' };
const LOCKED = 'כבר ענו מהמכשיר הזה';

function PhasePick({ check, onPick }: { check: ConceptCheck; onPick: (phase: CheckPhase) => void }) {
  return (
    <div className={k.stack}>
      <h1 className={k.h2}>{check.module_title}</h1>
      <p className={k.lead}>המדריך אומר אם זה לפני או אחרי. בחרו:</p>
      <div className={c.phaseRow}>
        {phasesOf(check).map((phase) => {
          const locked = isPhaseLocked(check.session_module_id, phase);
          return (
            <button key={phase} type="button" className={c.phaseBtn} disabled={locked} onClick={() => onPick(phase)}>
              {PHASE_LABEL[phase]}
              <span className={c.phaseSub}>{locked ? LOCKED : PHASE_SUB[phase]}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Options({ q, pick, onPick }: { q: ConceptQuestion; pick: number | null; onPick: (v: number) => void }) {
  if (isScale(q)) {
    const values = Array.from({ length: SCALE_MAX }, (_, i) => i + 1);
    return (
      <div className={k.stack}>
        <div className={c.scale} role="radiogroup" aria-label="דירוג מ-1 עד 5">
          {values.map((v) => (
            <button key={v} type="button" role="radio" aria-checked={pick === v}
              className={pick === v ? `${c.scaleBtn} ${c.scaleOn}` : c.scaleBtn} onClick={() => onPick(v)}>{v}</button>
          ))}
        </div>
        <div className={c.scaleEnds}><span>בכלל לא</span><span>מאוד</span></div>
      </div>
    );
  }
  return (
    <div className={c.options} role="radiogroup" aria-label="תשובות">
      {q.options.map((text, i) => (
        <button key={`${i}-${text}`} type="button" role="radio" aria-checked={pick === i}
          className={pick === i ? `${c.option} ${c.optionOn}` : c.option} onClick={() => onPick(i)}>
          <span className={c.letter} aria-hidden>{optionLetter(i)}</span>
          <span>{text}</span>
        </button>
      ))}
    </div>
  );
}

function Thanks({ onBack }: { onBack: () => void }) {
  return (
    <div className={`${k.card} ${k.center} ${k.stack}`}>
      <span className={c.thanks}><HugeiconsIcon icon={CheckmarkCircle02Icon} size={36} /></span>
      <h1 className={k.h2}>{THANKS}</h1>
      <button type="button" className={`${k.btn} ${k.btnPrimary}`} onClick={onBack}>חזרה לרשימה</button>
    </div>
  );
}

interface Props { check: ConceptCheck; onBack: () => void }

/** Phase first, then one question at a time, then a thank-you. Nothing identifying is sent or kept. */
export function CheckForm({ check, onBack }: Props) {
  const { questions } = check;
  const [phase, setPhase] = useState<CheckPhase | null>(null);
  const [index, setIndex] = useState(0);
  const [picks, setPicks] = useState<(number | null)[]>(() => questions.map(() => null));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  if (done) return <Thanks onBack={onBack} />;
  if (!phase) return <PhasePick check={check} onPick={setPhase} />;

  const q = questions[index];
  const last = index === questions.length - 1;
  const pick = picks[index] ?? null;
  const choose = (v: number) => setPicks((prev) => prev.map((p, i) => (i === index ? v : p)));

  async function submit() {
    if (!phase || !isComplete(questions, picks)) return;
    setBusy(true);
    setError('');
    try {
      await submitConceptCheck(check.session_module_id, phase, buildAnswers(questions, picks));
      lockPhase(check.session_module_id, phase);
      setDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'משהו השתבש. נסו שוב בעוד רגע');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={k.stack}>
      <div className={`${k.cardHead}`} style={{ justifyContent: 'space-between', marginBottom: 0 }}>
        <span className={c.counter}>{check.module_title} · {PHASE_LABEL[phase]}</span>
        <span className={c.counter}>{index + 1} / {questions.length}</span>
      </div>
      <div className={c.dots} aria-hidden>
        {questions.map((_, i) => (
          <i key={i} className={i === index ? `${c.dot} ${c.dotOn}` : picks[i] !== null ? `${c.dot} ${c.dotDone}` : c.dot} />
        ))}
      </div>
      <h2 className={c.question}>{q.q}</h2>
      <Options q={q} pick={pick} onPick={choose} />
      {error ? <p className={k.error} role="alert">{error}</p> : null}
      <div className={c.navRow}>
        <button type="button" className={k.btn} disabled={busy} onClick={() => (index === 0 ? setPhase(null) : setIndex(index - 1))}>
          הקודם
        </button>
        {last ? (
          <button type="button" className={`${k.btn} ${k.btnPrimary}`} disabled={busy || !isComplete(questions, picks)}
            onClick={() => void submit()}>{busy ? 'שומרים' : 'שליחה'}</button>
        ) : (
          <button type="button" className={`${k.btn} ${k.btnPrimary}`} disabled={pick === null} onClick={() => setIndex(index + 1)}>
            הבא
          </button>
        )}
      </div>
    </div>
  );
}
