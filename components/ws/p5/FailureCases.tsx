'use client';
import { useState } from 'react';
import { Drawer } from '../Drawer';
import { publicUrl } from '@/lib/db';
import { toast } from '@/lib/store';
import { FAILURE_KINDS, FAILURE_KIND_LABELS, type FailureCase, type FailureKind } from './validation';
import { PhotoGallery } from './PhotoGallery';
import styles from './p5.module.css';

interface FailureCasesProps {
  team: string;
  cases: readonly FailureCase[];
  disabled: boolean;
  /** persist the whole list; throws on failure */
  onChange: (next: FailureCase[]) => Promise<void>;
}

const isKind = (v: string): v is FailureKind => (FAILURE_KINDS as readonly string[]).includes(v);

/** Cases the model got wrong: frame, kind (miss / false hit / confusion) and a short note. */
export function FailureCases({ team, cases, disabled, onChange }: FailureCasesProps) {
  const [picking, setPicking] = useState(false);

  const commit = async (next: FailureCase[]) => {
    try {
      await onChange(next);
    } catch (err) {
      toast(err instanceof Error ? err.message : 'השמירה נכשלה');
    }
  };
  const update = (index: number, patch: Partial<FailureCase>) =>
    commit(cases.map((c, i) => (i === index ? { ...c, ...patch } : c)));

  return (
    <div className="stack">
      {cases.length === 0 ? <p className="hint">לא תועדו כשלים.</p> : null}
      {cases.map((c, i) => (
        <div key={`${c.frame_path}-${i}`} className={styles.failureRow}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={publicUrl(c.frame_path)} alt="" loading="lazy" className={styles.failureThumb} />
          <select value={c.kind} disabled={disabled} aria-label="סוג כשל"
            onChange={(e) => { if (isKind(e.target.value)) void update(i, { kind: e.target.value }); }}>
            {FAILURE_KINDS.map((k) => <option key={k} value={k}>{FAILURE_KIND_LABELS[k]}</option>)}
          </select>
          <input type="text" defaultValue={c.note} disabled={disabled} placeholder="מה קרה?" aria-label="הערה"
            maxLength={200} onBlur={(e) => { if (e.target.value !== c.note) void update(i, { note: e.target.value }); }} />
          {disabled ? null : (
            <button type="button" className="ghost sm" onClick={() => void commit(cases.filter((_, j) => j !== i))}>
              הסרה
            </button>
          )}
        </div>
      ))}
      {disabled ? null : <button type="button" className="sm" onClick={() => setPicking(true)}>הוספת כשל</button>}
      <Drawer open={picking} title="בחירת תמונה לכשל" width="640px" onClose={() => setPicking(false)}>
        <PhotoGallery team={team} pickLabel="הוסף ככשל" onPick={(photo) => {
          if (photo.frame_path) void commit([...cases, { frame_path: photo.frame_path, note: '', kind: 'confusion' }]);
          setPicking(false);
        }} />
      </Drawer>
    </div>
  );
}
