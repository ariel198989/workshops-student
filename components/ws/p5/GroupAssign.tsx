'use client';
import { useState } from 'react';
import { updateGroup } from '@/lib/ws/groups';
import type { WsGroup } from '@/lib/ws/types';
import { toast } from '@/lib/store';
import { hebrewDbError } from './validation';
import { groupLabel } from './labels';
import styles from './p5.module.css';

interface GroupAssignProps {
  subproblemId: string;
  groups: readonly WsGroup[];
  editable: boolean;
  onChanged: () => void;
}

/** One chip per group: on = assigned here. Clicking moves the group here, or unassigns it. */
export function GroupAssign({ subproblemId, groups, editable, onChanged }: GroupAssignProps) {
  const [busy, setBusy] = useState<string | null>(null);

  const toggle = async (g: WsGroup) => {
    setBusy(g.id);
    try {
      await updateGroup(g.id, { subproblem_id: g.subproblem_id === subproblemId ? null : subproblemId });
      onChanged();
    } catch (err) {
      toast(`הקצאה נכשלה: ${hebrewDbError(err)}`);
    } finally {
      setBusy(null);
    }
  };

  if (groups.length === 0) return <p className="hint">אין עדיין קבוצות בסדנה.</p>;
  return (
    <div className={styles.chipRow} role="group" aria-label="הקצאת קבוצות">
      {groups.map((g) => {
        const here = g.subproblem_id === subproblemId;
        const elsewhere = g.subproblem_id !== null && !here;
        const cls = [styles.toggleChip, here ? styles.toggleOn : '', elsewhere ? styles.toggleElsewhere : ''].join(' ');
        return (
          <button key={g.id} type="button" className={cls} aria-pressed={here}
            disabled={!editable || busy === g.id}
            title={elsewhere ? 'משויכת לתת-בעיה אחרת, לחיצה תעביר אותה לכאן' : undefined}
            onClick={() => void toggle(g)}>
            {groupLabel(g)}
          </button>
        );
      })}
    </div>
  );
}
