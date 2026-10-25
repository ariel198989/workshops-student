'use client';
import { useEffect, useState } from 'react';
import { toast } from '@/lib/store';
import { createGroups } from '@/lib/ws/groups';
import { errorText } from './hooks';
import styles from './board.module.css';

interface CreateGroupsFormProps {
  workshopId: string;
  defaultCount: number;
  /** the RPC is additive: the count is the target total, existing groups are kept */
  existing: number;
  onCreated: () => void;
}

const MAX_GROUPS = 40;

export function CreateGroupsForm({ workshopId, defaultCount, existing, onCreated }: CreateGroupsFormProps) {
  const [count, setCount] = useState<string>(String(Math.max(defaultCount, existing + 1)));
  const [busy, setBusy] = useState(false);
  const [touched, setTouched] = useState(false);
  const n = Number(count);
  // the default arrives after the workshop loads; never overwrite what the instructor typed
  useEffect(() => {
    if (!touched) setCount(String(Math.max(defaultCount, existing + 1)));
  }, [defaultCount, existing, touched]);
  const valid = Number.isInteger(n) && n >= 1 && n <= MAX_GROUPS && n > existing;

  const submit = async () => {
    setBusy(true);
    try {
      await createGroups(workshopId, n);
      toast(`נוצרו ${n - existing} קבוצות`, true);
      onCreated();
    } catch (err) {
      toast(errorText(err, 'יצירת הקבוצות נכשלה'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className={styles.countForm} onSubmit={(e) => { e.preventDefault(); if (valid) void submit(); }}>
      <label className={styles.countLbl} htmlFor="group-count">{existing > 0 ? 'סה"כ קבוצות' : 'מספר קבוצות'}</label>
      <input id="group-count" type="number" min={existing + 1} max={MAX_GROUPS} value={count}
        onChange={(e) => { setTouched(true); setCount(e.target.value); }} />
      <button type="submit" className="primary" disabled={!valid || busy}>צור קבוצות</button>
    </form>
  );
}
