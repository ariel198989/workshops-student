'use client';
// Step 1: two or three class names as chips.
import { useState } from 'react';
import { checkNewClass, MAX_CLASSES } from '@/lib/pocket/score';
import f from './facilitator.module.css';

const SUGGESTIONS = ['כוס', 'נעל', 'ספר', 'עיפרון', 'יד', 'בקבוק', 'כלום'];

interface Props {
  classes: string[];
  counts: Record<string, number>;
  onAdd: (name: string) => void;
  onRemove: (name: string) => void;
  onNext: () => void;
}

export function ClassesStep({ classes, counts, onAdd, onRemove, onNext }: Props) {
  const [draft, setDraft] = useState('');
  const [reason, setReason] = useState<string | null>(null);

  const add = (raw: string) => {
    const check = checkNewClass(raw, classes);
    if (!check.ok) { setReason(check.reason); return; }
    onAdd(check.name);
    setDraft('');
    setReason(null);
  };
  const remove = (name: string) => {
    if ((counts[name] ?? 0) > 0 && !window.confirm(`למחוק את "${name}" ואת כל הדוגמאות שלה?`)) return;
    onRemove(name);
  };
  const full = classes.length >= MAX_CLASSES;
  const suggestions = SUGGESTIONS.filter((s) => !classes.includes(s));

  return (
    <>
      <p className={f.lead}>מה המחשב ילמד להבדיל?</p>
      <p className={f.sub}>שתיים או שלוש מחלקות. אפשר לשנות אחר כך.</p>
      <div className={f.chips}>
        {classes.map((c) => (
          <span key={c} className={`${f.chip} ${f.chipOn}`}>
            {c}
            <button type="button" className={f.chipX} aria-label={`הסרת ${c}`} onClick={() => remove(c)}>×</button>
          </span>
        ))}
        {classes.length === 0 ? <span className={f.sub}>עוד אין מחלקות</span> : null}
      </div>
      {!full ? (
        <>
          <form className={f.addRow} onSubmit={(e) => { e.preventDefault(); add(draft); }}>
            <input type="text" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="שם של מחלקה" aria-label="שם מחלקה חדשה" maxLength={20} />
            <button type="submit" className="primary">הוספה</button>
          </form>
          <div className={f.suggest}>
            <span className={f.sub}>רעיונות:</span>
            {suggestions.map((s) => (
              <button key={s} type="button" className={f.suggestBtn} onClick={() => add(s)}>{s}</button>
            ))}
          </div>
        </>
      ) : <p className={f.sub}>עד {MAX_CLASSES} מחלקות. להוספה, הסירו אחת.</p>}
      {reason ? <p className={f.err} role="alert">{reason}</p> : null}
      <div className={f.actions}>
        <button type="button" className={`primary ${f.bigBtn}`} disabled={classes.length < 2} onClick={onNext}>
          הלאה, מלמדים
        </button>
      </div>
    </>
  );
}
