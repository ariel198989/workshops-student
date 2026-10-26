'use client';
// ״מקרן״: big type, agenda only, one module at a time with prev/next.
import { useEffect, useState } from 'react';
import { minutesHe, type ModuleRow } from '@/lib/facilitator/guide';
import { AgendaList, type AgendaEntry } from './AgendaList';
import { NowBar } from './NowBar';
import type { Countdown } from './useCountdown';
import { Tpl } from './Tpl';
import g from './guide.module.css';

interface Props {
  sessionLabel: string;
  modules: ModuleRow[];
  entriesByModule: Record<string, AgendaEntry[]>;
  done: ReadonlySet<string>;
  now: AgendaEntry | null;
  clock: Countdown;
  initialModuleId: string | null;
  onToggle: (id: string) => void;
  onExit: () => void;
}

export function Projector({ sessionLabel, modules, entriesByModule, done, now, clock, initialModuleId, onToggle, onExit }: Props) {
  const startAt = Math.max(0, modules.findIndex((m) => m.id === initialModuleId));
  const [idx, setIdx] = useState(startAt);
  const m = modules[Math.min(idx, modules.length - 1)];

  // Escape leaves; arrows move between modules (keyboard on the projector laptop)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onExit();
      else if (e.key === 'ArrowLeft') setIdx((i) => Math.min(modules.length - 1, i + 1));
      else if (e.key === 'ArrowRight') setIdx((i) => Math.max(0, i - 1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [modules.length, onExit]);

  if (!m) return null;
  const entries = entriesByModule[m.id] ?? [];
  const doneCount = entries.filter((e) => done.has(e.id)).length;

  return (
    <div className={g.proj} role="dialog" aria-modal="true" aria-label="מצב מקרן">
      <header className={g.projHead}>
        <button type="button" className={g.projBtn} onClick={onExit}>יציאה ממקרן</button>
        <span className={g.projSession}>{sessionLabel}</span>
        {modules.length > 1 ? (
          <nav className={g.projNav} aria-label="מודולים">
            <button type="button" className={g.projBtn} disabled={idx === 0} onClick={() => setIdx(idx - 1)} aria-label="המודול הקודם">‹ הקודם</button>
            <span className={g.projCount} dir="ltr">{idx + 1} / {modules.length}</span>
            <button type="button" className={g.projBtn} disabled={idx >= modules.length - 1} onClick={() => setIdx(idx + 1)} aria-label="המודול הבא">הבא ›</button>
          </nav>
        ) : null}
      </header>
      <h2 className={g.projTitle}>
        <Tpl text={m.title ?? 'מודול'} />
        {m.duration_minutes ? <span className={g.projDur}> · {minutesHe(m.duration_minutes)}</span> : null}
      </h2>
      <div className={g.projBody}>
        <AgendaList entries={entries} done={done} nowId={now?.id ?? null} big onToggle={onToggle} />
      </div>
      <NowBar now={now} clock={clock} total={entries.length} doneCount={doneCount} big onDone={onToggle} />
    </div>
  );
}
