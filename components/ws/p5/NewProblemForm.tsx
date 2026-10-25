'use client';
import { useState, type FormEvent } from 'react';
import { saveProblem } from '@/lib/ws/workshops';
import { toast } from '@/lib/store';
import { hebrewDbError } from './validation';
import styles from './p5.module.css';

interface NewProblemFormProps {
  workshopId: string;
  onCreated: () => void;
}

/** Empty state of the problems tab: the three fields that make a mega-problem real. */
export function NewProblemForm({ workshopId, onCreated }: NewProblemFormProps) {
  const [clientName, setClientName] = useState('');
  const [title, setTitle] = useState('');
  const [statement, setStatement] = useState('');
  const [busy, setBusy] = useState(false);
  const valid = title.trim() !== '' && statement.trim() !== '';

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!valid || busy) return;
    setBusy(true);
    try {
      await saveProblem({
        workshop_id: workshopId, is_primary: true, title: title.trim(), statement: statement.trim(),
        client_name: clientName.trim() || null,
      });
      onCreated();
    } catch (err) {
      toast(`יצירת הבעיה נכשלה: ${hebrewDbError(err)}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className={`hud card ${styles.newForm}`} onSubmit={(e) => void submit(e)}>
      <h2 className={styles.cardTitle}>בעיית-על חדשה</h2>
      <p className="hint">אין עדיין בעיית-על. הגדירו את הבעיה של הלקוח, ואחר כך פרקו אותה לתת-בעיות.</p>
      <label className="field">
        <span className="lbl">לקוח</span>
        <input type="text" value={clientName} onChange={(e) => setClientName(e.target.value)} />
      </label>
      <label className="field">
        <span className="lbl">כותרת</span>
        <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} required />
      </label>
      <label className="field">
        <span className="lbl">הגדרת הבעיה</span>
        <textarea rows={4} value={statement} onChange={(e) => setStatement(e.target.value)} required />
      </label>
      <button type="submit" className="primary" disabled={!valid || busy}>צור בעיית-על</button>
    </form>
  );
}
