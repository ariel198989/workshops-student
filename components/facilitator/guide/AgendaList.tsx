'use client';
// The agenda of one module as a checklist: minute badge, 44px checkbox, the
// next unchecked item carries the ״עכשיו״ tag. `big` is the projector size.
import type { AgendaItem } from '@/lib/facilitator/guide';
import { minutesHe } from '@/lib/facilitator/guide';
import { Tpl } from './Tpl';
import g from './guide.module.css';

export interface AgendaEntry { id: string; moduleId: string; index: number; item: AgendaItem }

interface Props {
  entries: AgendaEntry[];
  done: ReadonlySet<string>;
  nowId: string | null;
  big?: boolean;
  onToggle: (id: string) => void;
}

export function AgendaList({ entries, done, nowId, big = false, onToggle }: Props) {
  if (entries.length === 0) return <p className={g.quiet}>אין סדר יום למודול הזה.</p>;
  return (
    <ol className={`${g.agenda} ${big ? g.agendaBig : ''}`} aria-label="סדר יום">
      {entries.map((e) => {
        const isDone = done.has(e.id);
        const isNow = e.id === nowId;
        return (
          <li key={e.id} className={`${g.agendaItem} ${isDone ? g.agendaDone : ''} ${isNow ? g.agendaNow : ''}`}>
            <button type="button" role="checkbox" aria-checked={isDone} className={`${g.check} ${isDone ? g.checkOn : ''}`}
              aria-label={`${isDone ? 'ביטול סימון' : 'סימון'}: ${e.item.title}`} onClick={() => onToggle(e.id)}>
              <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </button>
            <div className={g.agendaText}>
              <div className={g.agendaHead}>
                {e.item.minutes !== null ? <span className={g.min}>{minutesHe(e.item.minutes)}</span> : null}
                <span className={g.itemTitle}><Tpl text={e.item.title} /></span>
                {isNow ? <span className={g.nowTag}>עכשיו</span> : null}
              </div>
              {e.item.text ? <p className={g.itemText}><Tpl text={e.item.text} /></p> : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
