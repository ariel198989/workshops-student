'use client';
// Sticky bar: ״עכשיו: <item> · N ד׳״, a start/pause countdown and ״סיימנו״.
// The clock itself lives in GuideStep so the phone bar and the projector share it.
// With a real workshop it also shows what the students see (״בכיתה״) and the הפסקה / ניקוי buttons.
import { fmtClock, minutesHe } from '@/lib/facilitator/guide';
import type { AgendaEntry } from './AgendaList';
import { Tpl } from './Tpl';
import type { Countdown } from './useCountdown';
import g from './guide.module.css';

export interface LiveControls {
  /** what the students see right now; null when nothing is broadcast */
  label: string | null;
  busy: boolean;
  onBreak: () => void;
  onClear: () => void;
}

interface Props {
  now: AgendaEntry | null;
  clock: Countdown;
  total: number;
  doneCount: number;
  big?: boolean;
  onDone: (id: string) => void;
  live?: LiveControls | null;
}

export const itemSeconds = (now: AgendaEntry | null): number => (now?.item.minutes ?? 0) * 60;

function LiveRow({ live }: { live: LiveControls }) {
  return (
    <div className={g.liveRow}>
      <span className={g.liveLabel}>בכיתה:</span>
      <span className={g.liveValue}>{live.label ?? 'לא משודר'}</span>
      <button type="button" className={`${g.timerBtn} ${g.liveBtn}`} disabled={live.busy} onClick={live.onBreak}>הפסקה</button>
      <button type="button" className={`${g.timerBtn} ${g.liveBtn} ghost`} disabled={live.busy || live.label === null} onClick={live.onClear}>ניקוי</button>
    </div>
  );
}

export function NowBar({ now, clock, total, doneCount, big = false, onDone, live = null }: Props) {
  const seconds = itemSeconds(now);

  if (!now) {
    return (
      <div className={`${g.nowBar} ${big ? g.nowBarBig : ''}`} role="status">
        <span className={g.nowLabel}>{total > 0 && doneCount >= total ? 'סיימנו את כל סדר היום.' : 'אין פריטים בסדר היום.'}</span>
        {live ? <LiveRow live={live} /> : null}
      </div>
    );
  }
  return (
    <div className={`${g.nowBar} ${big ? g.nowBarBig : ''}`} role="status" aria-live="polite">
      <div className={g.nowText}>
        <span className={g.nowLabel}>עכשיו:</span>
        <span className={g.nowItem}><Tpl text={now.item.title} /></span>
        {now.item.minutes !== null ? <span className={g.nowMin}>· {minutesHe(now.item.minutes)}</span> : null}
      </div>
      <div className={g.timer}>
        <span className={`${g.clock} ${clock.over ? g.clockOver : ''} ${clock.running ? g.clockOn : ''}`} dir="ltr">{fmtClock(clock.remaining)}</span>
        <button type="button" className={g.timerBtn} disabled={seconds === 0} aria-pressed={clock.running} onClick={clock.toggle}>
          {clock.running ? 'עצירה' : clock.remaining < seconds ? 'המשך' : 'התחלה'}
        </button>
        <button type="button" className={`${g.timerBtn} ghost`} disabled={seconds === 0 || clock.remaining === seconds} onClick={() => clock.reset(seconds)}>איפוס</button>
      </div>
      <button type="button" className={`primary ${g.doneBtn}`} onClick={() => onDone(now.id)}>סיימנו</button>
      {live ? <LiveRow live={live} /> : null}
    </div>
  );
}
