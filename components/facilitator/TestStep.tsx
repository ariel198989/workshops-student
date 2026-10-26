'use client';
// Step 3: live prediction with the colour bar, the freeze button and the
// "X מתוך 10" sheet. No percentages reach the screen.
import { useEffect, useState } from 'react';
import {
  barLevel, confidenceWord, emptyTally, recordResult, TALLY_SIZE, tallyFull, tallyLabel, type Tally,
} from '@/lib/pocket/score';
import { moodFromPrediction } from '@/lib/robot/mood';
import type { RobotApi } from '@/lib/robot/useRobot';
import { RobotFace } from './robot/RobotFace';
import { SpeechBubble } from './robot/SpeechBubble';
import { useFacilitatorCamera } from './useFacilitatorCamera';
import { useLivePrediction } from './useLivePrediction';
import f from './facilitator.module.css';

export function PredictionOverlay({ label, confidence, known }: { label: string | null; confidence: number; known: boolean }) {
  const level = known && label ? barLevel(confidence) : 'red';
  const word = known && label ? confidenceWord(confidence) : 'לא מכיר';
  const shown = level === 'red' ? null : label;
  return (
    <div className={f.overlay} aria-live="polite">
      <div className={f.predName}>{shown ?? '?'}</div>
      <div className={f.bar} aria-hidden>
        <div className={`${f.barFill} ${f[level]}`} style={{ width: `${Math.round(Math.max(0.04, confidence) * 100)}%` }} />
      </div>
      <div className={f.predWord}>{word}</div>
    </div>
  );
}

function TallyPanel({ tally, onMark, onReset }: { tally: Tally; onMark: (ok: boolean) => void; onReset: () => void }) {
  return (
    <section className={f.tally} aria-label="בדיקה">
      <div className={f.tallyHead}>
        <span className={f.lead}>בדיקה</span>
        <span className={f.tallyScore}>{tallyLabel(tally)}</span>
      </div>
      <div className={f.cells}>
        {Array.from({ length: TALLY_SIZE }, (_, i) => {
          const v = tally.cells[i];
          const cls = v === undefined ? f.cellNo : v ? f.cellOk : f.cellBad;
          return <span key={i} className={`${f.cell} ${cls}`}>{v === undefined ? i + 1 : v ? '✓' : '✗'}</span>;
        })}
      </div>
      <div className={f.actions}>
        <button type="button" className={`${f.bigBtn} ${f.okBtn}`} disabled={tallyFull(tally)} onClick={() => onMark(true)}>צדק</button>
        <button type="button" className={`${f.bigBtn} ${f.badBtn}`} disabled={tallyFull(tally)} onClick={() => onMark(false)}>טעה</button>
        <span className={f.grow} />
        <button type="button" onClick={onReset} disabled={tally.cells.length === 0}>אפס</button>
      </div>
    </section>
  );
}

export function TestStep({ ready, robot, onNext }: { ready: boolean; robot: RobotApi; onNext: () => void }) {
  const cam = useFacilitatorCamera();
  const liveOn = ready && cam.state === 'live';
  const live = useLivePrediction(cam.videoRef, liveOn);
  const [tally, setTally] = useState<Tally>(emptyTally);
  const p = live.prediction;
  const { say } = robot;

  // רובי watches the same prediction the bar shows; the reducer ignores unchanged ticks
  useEffect(() => {
    if (!liveOn) { say('idle'); return; }
    say(moodFromPrediction(p, live.frozen), { className: p?.label ?? null });
  }, [liveOn, p, live.frozen, say]);
  useEffect(() => () => say('idle'), [say]);

  const mark = (ok: boolean) => {
    setTally((t) => recordResult(t, ok));
    say(ok ? 'right' : 'wrong');
  };

  return (
    <>
      <div className={f.testRow}>
        <div className={f.stage}>
          <video ref={cam.videoRef} className={f.video} playsInline muted />
          {cam.state === 'error' ? (
            <div className={f.stageMsg} role="alert">
              <div>
                <p>{cam.error}</p>
                <button type="button" className="primary" onClick={cam.retry}>ניסיון נוסף</button>
              </div>
            </div>
          ) : !ready ? (
            <div className={f.stageMsg}><p>עוד אין מודל. למדו לפחות שתי מחלקות קודם.</p></div>
          ) : null}
          {live.frozen ? <span className={f.frozenTag}>עצור</span> : null}
          {liveOn ? (
            <PredictionOverlay label={p?.label ?? null} confidence={p?.confidence ?? 0} known={!!p} />
          ) : null}
        </div>
        <aside className={f.robotCol} aria-label="רובי">
          <RobotFace size="lg" mood={robot.mood} speaking={robot.speaking} gaze={0.6} />
          <SpeechBubble line={robot.line} />
        </aside>
      </div>
      {live.error ? <p className={f.err} role="alert">{live.error}</p> : null}
      <div className={f.actions}>
        <button type="button" className={`${f.bigBtn} ${live.frozen ? 'primary' : ''}`} disabled={!ready} aria-pressed={live.frozen}
          onClick={() => live.setFrozen(!live.frozen)}>
          {live.frozen ? 'המשך' : 'עצור'}
        </button>
        <span className={f.sub}>עצרו, תנו לכיתה לנחש, ואז המשיכו.</span>
        <span className={f.grow} />
        <button type="button" className="primary" onClick={onNext} disabled={!ready}>הלאה, רמזור</button>
      </div>
      <TallyPanel tally={tally} onMark={mark} onReset={() => setTally(emptyTally())} />
    </>
  );
}
