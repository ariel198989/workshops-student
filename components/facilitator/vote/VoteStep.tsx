'use client';
// הצבעה במצלמה: every child holds up a green or red card, the camera counts
// the cards, two giant tiles show the tally. The "guess before the reveal"
// moment for grades 1-4, and a general classroom voting tool. Counts only,
// never percentages.
import { useEffect, useRef, useState } from 'react';
import { useFacilitatorCamera } from '../useFacilitatorCamera';
import { useFullscreen } from './useFullscreen';
import { useVoteCount } from './useVoteCount';
import s from './vote.module.css';

export interface VoteStepProps {
  /** Initial question shown huge above the camera; the facilitator can edit it on screen. */
  question?: string;
}

const QUESTION_MAX = 120;

function CountTile({ colour, value }: { colour: 'green' | 'red'; value: number }) {
  const [pop, setPop] = useState(false);
  const prev = useRef(value);
  useEffect(() => {
    if (prev.current === value) return;
    prev.current = value;
    setPop(true);
    const id = setTimeout(() => setPop(false), 250);
    return () => clearTimeout(id);
  }, [value]);
  const label = colour === 'green' ? 'ירוק' : 'אדום';
  return (
    <div className={`${s.tile} ${colour === 'green' ? s.tileGreen : s.tileRed}`} role="status" aria-live="polite" aria-label={`${label} ${value}`}>
      <span className={s.tileLabel}>{label}</span>
      <span className={`${s.tileNum} ${pop ? s.pop : ''}`}>{value}</span>
    </div>
  );
}

export function VoteStep({ question: initialQuestion = '' }: VoteStepProps) {
  const rootRef = useRef<HTMLElement | null>(null);
  const cam = useFacilitatorCamera();
  const vote = useVoteCount(cam.videoRef, cam.state === 'live');
  const fs = useFullscreen(rootRef);
  const [question, setQuestion] = useState(initialQuestion);

  useEffect(() => { setQuestion(initialQuestion); }, [initialQuestion]);

  const green = Math.round(vote.counts.green);
  const red = Math.round(vote.counts.red);

  return (
    <section ref={rootRef} className={`${s.root} ${fs.fallback ? s.fixed : ''}`} aria-label="הצבעה במצלמה">
      <h2 className={`${s.question} ${question ? '' : s.questionEmpty}`}>{question || 'הרימו כרטיס: ירוק או אדום'}</h2>

      <div className={s.stage}>
        <video ref={cam.videoRef} className={s.video} playsInline muted />
        <canvas ref={vote.overlayRef} className={s.tint} aria-hidden />
        {cam.state === 'error' ? (
          <div className={s.stageMsg} role="alert">
            <div>
              <p>{cam.error}</p>
              <button type="button" className="primary" onClick={cam.retry}>ניסיון נוסף</button>
            </div>
          </div>
        ) : null}
        {vote.frozen ? <span className={s.frozenTag}>מוקפא</span> : null}
      </div>

      <div className={s.tiles}>
        <CountTile colour="green" value={green} />
        <CountTile colour="red" value={red} />
      </div>

      <div className={s.controls}>
        <button type="button" className={`${s.bigBtn} ${vote.frozen ? 'primary' : ''}`} aria-pressed={vote.frozen}
          disabled={cam.state !== 'live'} onClick={() => vote.setFrozen(!vote.frozen)}>
          {vote.frozen ? 'המשך' : 'הקפא'}
        </button>
        <button type="button" onClick={vote.reset} disabled={cam.state !== 'live'}>איפוס</button>
        <label className={s.sens}>
          <span>רגישות</span>
          <input type="range" min={0} max={1} step={0.05} value={vote.sensitivity}
            onChange={(e) => vote.setSensitivity(Number(e.target.value))} aria-label="רגישות הזיהוי" />
        </label>
        <span className={s.grow} />
        <button type="button" onClick={fs.toggle} aria-pressed={fs.on}>{fs.on ? 'יציאה ממסך מלא' : 'מסך מלא'}</button>
        <div className={s.questionRow}>
          <input type="text" value={question} maxLength={QUESTION_MAX} placeholder="שאלה לכיתה, למשל: האם הרובוט יזהה את הכוס הכחולה?"
            onChange={(e) => setQuestion(e.target.value)} aria-label="שאלה לכיתה" />
          {question ? <button type="button" className="ghost" onClick={() => setQuestion('')}>נקה</button> : null}
        </div>
      </div>
      <p className={s.sub}>הכרטיסים הצבעוניים נצבעים על המסך. אם המספר קופץ, הנמיכו את הרגישות; אם כרטיסים לא נספרים, הגבירו.</p>
    </section>
  );
}
