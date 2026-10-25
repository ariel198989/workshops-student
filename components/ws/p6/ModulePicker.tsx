'use client';
import { useEffect, useMemo, useState } from 'react';
import { Spinner } from '@/components/ui/Spinner';
import { listModules } from '@/lib/ws/curriculum';
import { toast } from '@/lib/store';
import type { WsModule } from '@/lib/ws/types';
import { Drawer } from '../Drawer';
import { errText } from './errors';
import { EMPTY_FILTERS, filterModules } from './filters';
import { stageLabel, typeLabel } from './labels';
import styles from './board.module.css';

interface Props {
  open: boolean;
  sessionNo: number;
  onPick: (moduleId: string) => void;
  onClose: () => void;
}

/** Library picker used to add a module to a session. Loads once, filters locally. */
export function ModulePicker({ open, sessionNo, onPick, onClose }: Props) {
  const [modules, setModules] = useState<WsModule[] | null>(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!open || modules !== null) return;
    let alive = true;
    listModules()
      .then((m) => { if (alive) setModules(m); })
      .catch((err: unknown) => { if (alive) { setModules([]); toast(errText('הטעינה נכשלה', err)); } });
    return () => { alive = false; };
  }, [open, modules]);

  const visible = useMemo(() => filterModules(modules ?? [], { ...EMPTY_FILTERS, search }), [modules, search]);

  return (
    <Drawer open={open} title={`הוספת מודול למפגש ${sessionNo}`} onClose={onClose}>
      <input type="search" placeholder="חיפוש מודול" aria-label="חיפוש" value={search}
        onChange={(e) => setSearch(e.target.value)} autoFocus />
      {modules === null ? <div className="row" style={{ marginTop: 16 }}><Spinner /></div> : (
        <div className={styles.pickList}>
          {visible.map((m) => (
            <button key={m.id} type="button" className={styles.pickItem} onClick={() => onPick(m.id)}>
              <span className="ink">{m.title}</span>
              <span className={styles.pickMeta}>
                {typeLabel(m.module_type)}{m.pipeline_stage ? ` · ${stageLabel(m.pipeline_stage)}` : ''} · {m.duration_minutes} ד׳
              </span>
            </button>
          ))}
          {visible.length === 0 ? <p className="hint">לא נמצאו מודולים.</p> : null}
        </div>
      )}
    </Drawer>
  );
}
