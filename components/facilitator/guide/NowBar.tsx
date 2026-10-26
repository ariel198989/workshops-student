'use client';
// Sticky bar: ״עכשיו: <item> · N ד׳״, a start/pause countdown and ״סיימנו״.
// The clock itself lives in GuideStep so the phone bar and the projector share it.
import { fmtClock, minutesHe } from '@/lib/facilitator/guide';
import type { AgendaEntry } from './AgendaList';
import { Tpl } from './Tpl';
import type { Countdown } from './useCountdown';
import g from './guide.module.css';

interface Props {
  now: AgendaEntry | null;
  clock: Countdown;
  total: number;
  doneCount: number;
  big?: boolean;
  onDone: (id: string) => void;
}

export const itemSeconds = (now: AgendaEntry | null): number => (now?.item.minutes ?? 0) * 60;

export function NowBar({ now, clock, total, doneCount, big = false, onDone }: Props) {
  const seconds = itemSeconds(now);

  if (!now) {
    return (
      <div className={`${g.nowBar} ${big ? g.nowBarBig : ''}`} role="status">
        <span className={g.nowLabel}>{total > 0 && doneCount >= total ? 'סיימנו את כל סדר היום.' : 'אין פריטים בסדר היום.'}</span>
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
    </div>
  );
}
