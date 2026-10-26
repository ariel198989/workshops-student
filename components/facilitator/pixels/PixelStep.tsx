'use client';
// זום פיקסלים חי: the camera on the class or an object, shown at 8 → 16 → 32 →
// 64 → 128 columns and then the full picture. Kids guess "מי זה? מה זה?" at
// every level; 'מספרים' shows the digit the computer gets for each square.
import { useCallback, useEffect, useState } from 'react';
import {
  canShowDigits, cellCountLabel, FULL, fullCountLabel, LEVELS, nextLevel, prevLevel, type PixelLevel,
} from '@/lib/pixels/pixelate';
import { useFacilitatorCamera } from '../useFacilitatorCamera';
import { usePixelCanvas, type PixelInfo } from './usePixelCanvas';
import s from './pixels.module.css';

export type PixelStepProps = {
  /** Called from the 'יציאה' button when the step is shown inside its own fullscreen only; optional. */
  onExit?: () => void;
};

function counterText(level: PixelLevel, info: PixelInfo): string {
  if (level === FULL) return info.fullSize ? fullCountLabel(info.fullSize.width, info.fullSize.height) : 'התמונה המלאה';
  if (info.cols > 0 && info.rows > 0) return cellCountLabel(info.cols, info.rows);
  return `${level} ריבועים לרוחב`;
}

function DigitGrid({ info }: { info: PixelInfo }) {
  if (!info.digits || info.cols === 0) return null;
  return (
    <div className={s.digits} aria-hidden
      style={{ gridTemplateColumns: `repeat(${info.cols}, 1fr)`, fontSize: `calc(${55 / info.cols}cqw)` }}>
      {info.digits.map((d, i) => (
        <span key={i} className={`${s.digit} ${d >= 5 ? s.digitDark : s.digitLight}`}>{d}</span>
      ))}
    </div>
  );
}

function LevelButtons({ level, onPick }: { level: PixelLevel; onPick: (l: PixelLevel) => void }) {
  return (
    <div className={s.levels} role="group" aria-label="רמת פיקסלים">
      {LEVELS.map((l) => (
        <button key={l} type="button" className={`${s.levelBtn} ${level === l ? s.levelOn : ''}`}
          aria-pressed={level === l} onClick={() => onPick(l)}>{l}</button>
      ))}
      <button type="button" className={`${s.levelBtn} ${level === FULL ? s.levelOn : ''}`}
        aria-pressed={level === FULL} onClick={() => onPick(FULL)}>מלא</button>
    </div>
  );
}

export function PixelStep({ onExit }: PixelStepProps = {}) {
  const cam = useFacilitatorCamera();
  const [level, setLevel] = useState<PixelLevel>(LEVELS[0]);
  const [gray, setGray] = useState(false);
  const [digits, setDigits] = useState(false);
  const [frozen, setFrozen] = useState(false);
  const [full, setFull] = useState(false);
  const { canvasRef, info } = usePixelCanvas(cam.videoRef, cam.state === 'live', { level, gray, frozen, digits });

  const next = useCallback(() => setLevel((l) => nextLevel(l)), []);
  const prev = useCallback(() => setLevel((l) => prevLevel(l)), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'ArrowRight') { e.preventDefault(); next(); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); prev(); }
      else if (e.key === 'Escape') setFull(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [next, prev]);

  const aspect = level === FULL
    ? (info.fullSize ? info.fullSize.width / info.fullSize.height : 4 / 3)
    : (info.cols && info.rows ? info.cols / info.rows : 4 / 3);
  const digitsAllowed = canShowDigits(level);
  const atEnd = level === FULL;

  return (
    <div className={full ? s.wrapFull : s.wrap} role={full ? 'dialog' : undefined} aria-label="זום פיקסלים">
      {full ? <button type="button" className={s.exitFull} onClick={() => setFull(false)}>יציאה</button> : null}
      <div className={s.stage} style={{ '--ar': aspect } as React.CSSProperties}>
        <video ref={cam.videoRef} className={s.hiddenVideo} playsInline muted />
        <canvas ref={canvasRef} className={s.canvas} aria-label="המצלמה בפיקסלים" />
        {digitsAllowed ? <DigitGrid info={info} /> : null}
        {frozen ? <span className={s.frozenTag}>הקפאה</span> : null}
        {cam.state === 'error' ? (
          <div className={s.stageMsg} role="alert">
            <div>
              <p>{cam.error}</p>
              <button type="button" className="primary" onClick={cam.retry}>ניסיון נוסף</button>
            </div>
          </div>
        ) : cam.state === 'starting' ? (
          <div className={s.stageMsg}><p>המצלמה נפתחת</p></div>
        ) : null}
      </div>

      <div className={s.count} aria-live="polite">{counterText(level, info)}</div>

      <LevelButtons level={level} onPick={setLevel} />

      <div className={s.toggles}>
        <button type="button" className={`${s.toggle} ${digits ? s.toggleOn : ''}`} aria-pressed={digits}
          disabled={!digitsAllowed} title={digitsAllowed ? undefined : 'מספרים רק ב-8 וב-16'}
          onClick={() => setDigits((v) => !v)}>מספרים</button>
        <button type="button" className={`${s.toggle} ${gray ? s.toggleOn : ''}`} aria-pressed={gray}
          onClick={() => setGray((v) => !v)}>שחור-לבן</button>
        <button type="button" className={`${s.toggle} ${frozen ? s.toggleOn : ''}`} aria-pressed={frozen}
          disabled={cam.state !== 'live'} onClick={() => setFrozen((v) => !v)}>{frozen ? 'המשך' : 'הקפא'}</button>
        <span className={s.grow} />
        <button type="button" className={`${s.toggle} ${full ? s.toggleOn : ''}`} aria-pressed={full}
          onClick={() => setFull((v) => !v)}>{full ? 'יציאה ממסך מלא' : 'מסך מלא'}</button>
        <button type="button" className={`primary ${s.nextBtn}`} disabled={atEnd} onClick={next}>הבא</button>
        {onExit && !full ? <button type="button" onClick={onExit}>סיום</button> : null}
      </div>
      {!digitsAllowed && digits ? <p className={s.hint}>המספרים מוצגים רק ב-8 וב-16 ריבועים</p> : null}
    </div>
  );
}
