'use client';
import { useState, type FormEvent } from 'react';
import { validateClassName } from '@/lib/cv/capture-utils';
import c from './camera.module.css';

interface Props {
  classes: string[];
  active: string;
  counts: (cls: string) => number;
  onPick: (cls: string) => void;
  /** only offered when the mission has no target objects */
  allowCustom: boolean;
  onAdd: (cls: string) => void;
}

/** Object chips on top of the camera. Counts update live as frames are taken. */
export function ClassPicker({ classes, active, counts, onPick, allowCustom, onAdd }: Props) {
  const [adding, setAdding] = useState(classes.length === 0);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');

  function submit(e: FormEvent) {
    e.preventDefault();
    const check = validateClassName(draft);
    if (!check.ok) { setError(check.reason); return; }
    onAdd(check.name);
    setDraft('');
    setError('');
    setAdding(false);
  }

  return (
    <>
      <div className={c.classes} role="tablist" aria-label="בחירת אובייקט לצילום">
        {classes.map((cls) => (
          <button key={cls} type="button" role="tab" aria-selected={cls === active}
            className={cls === active ? `${c.cls} ${c.clsOn}` : c.cls} onClick={() => onPick(cls)}>
            {cls}<span className="num">{counts(cls)}</span>
          </button>
        ))}
        {allowCustom && !adding ? (
          <button type="button" className={c.cls} onClick={() => setAdding(true)}>+ אובייקט</button>
        ) : null}
      </div>
      {allowCustom && adding ? (
        <form className={c.addForm} onSubmit={submit}>
          <input className={c.addInput} value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={60}
            placeholder="איזה אובייקט מצלמים? למשל: כוס" aria-label="שם האובייקט" />
          <button type="submit" className={`${c.cls} ${c.clsOn}`}>הוספה</button>
        </form>
      ) : null}
      {error ? <p className={c.addErr} role="alert">{error}</p> : null}
    </>
  );
}
