'use client';
import { useEffect, useState } from 'react';
import { InlineEdit } from '../InlineEdit';
import { TargetClassesInput } from '../TargetClassesInput';
import { ConfirmButton } from '../ConfirmButton';
import { deleteSubproblem } from '@/lib/ws/workshops';
import { TASK_TYPES, type TaskType, type WsGroup, type WsSubproblem } from '@/lib/ws/types';
import { toast } from '@/lib/store';
import { patchSubproblem, type SubproblemPatch } from './api';
import { Field } from './Field';
import { GroupAssign } from './GroupAssign';
import { asText, groupLabel, requiredText, TASK_TYPE_LABELS, toOptions } from './labels';
import styles from './p5.module.css';
import { hebrewDbError, parsePercent, toPercent } from './validation';

const TASK_OPTIONS = toOptions(TASK_TYPE_LABELS);
const isTaskType = (v: unknown): v is TaskType => TASK_TYPES.includes(v as TaskType);
const PERCENT_MSG = 'יש להזין מספר בין 0 ל-100';

interface SubproblemEditorProps {
  sub: WsSubproblem;
  groups: readonly WsGroup[];
  editable: boolean;
  onChanged: () => void;
}

export function SubproblemEditor({ sub, groups, editable, onChanged }: SubproblemEditorProps) {
  const [classes, setClasses] = useState<readonly string[]>(sub.target_classes);
  useEffect(() => setClasses(sub.target_classes), [sub.target_classes]);
  const assigned = groups.filter((g) => g.subproblem_id === sub.id);

  const save = async (patch: SubproblemPatch) => {
    await patchSubproblem(sub.id, patch);
    onChanged();
  };

  const saveClasses = async (next: string[]) => {
    const previous = classes;
    setClasses(next);
    try {
      await save({ target_classes: next });
    } catch (err) {
      setClasses(previous);
      toast(`שמירת האובייקטים נכשלה: ${err instanceof Error ? err.message : hebrewDbError(err)}`);
    }
  };

  const savePercent = (v: string | number | null) => {
    const parsed = parsePercent(v === null ? '' : String(v));
    if (!parsed.ok) throw new Error(PERCENT_MSG);
    return save({ target_accuracy: parsed.value });
  };

  return (
    <article className={`hud card ${styles.subCard}`}>
      <header className={styles.cardHead}>
        <h3 className={styles.cardTitle}>
          <InlineEdit value={sub.title} disabled={!editable} ariaLabel="כותרת תת-בעיה"
            onSave={(v) => save({ title: requiredText(v) })} />
        </h3>
        <span className={styles.metaRow}>
          <span className="pill idle">{assigned.length} קבוצות</span>
          {editable ? (
            <ConfirmButton small tone="danger" label="מחיקה" confirmText="למחוק את תת-הבעיה?"
              onConfirm={async () => { await deleteSubproblem(sub.id); onChanged(); }} />
          ) : null}
        </span>
      </header>
      <div className={styles.grid2}>
        <Field label="תיאור" wide>
          <InlineEdit type="textarea" value={sub.statement} disabled={!editable} ariaLabel="תיאור"
            onSave={(v) => save({ statement: asText(v) })} />
        </Field>
        <Field label="סוג משימה">
          <InlineEdit type="select" value={sub.task_type} options={TASK_OPTIONS} disabled={!editable}
            ariaLabel="סוג משימה" onSave={(v) => { if (isTaskType(v)) return save({ task_type: v }); }} />
        </Field>
        <Field label="דיוק יעד (%)">
          <InlineEdit type="number" value={toPercent(sub.target_accuracy)} disabled={!editable}
            ariaLabel="דיוק יעד" display={(v) => (v === null ? null : `${v}%`)} onSave={savePercent} />
        </Field>
        <Field label="מדד הצלחה">
          <InlineEdit value={sub.success_metric} disabled={!editable} ariaLabel="מדד הצלחה"
            onSave={(v) => save({ success_metric: asText(v) })} />
        </Field>
        <Field label="תוכנית דאטה">
          <InlineEdit type="textarea" value={sub.data_plan} disabled={!editable} ariaLabel="תוכנית דאטה"
            onSave={(v) => save({ data_plan: asText(v) })} />
        </Field>
        <Field label="אובייקטי יעד" wide>
          <TargetClassesInput value={classes} disabled={!editable} onChange={(next) => void saveClasses(next)} />
        </Field>
        <Field label="קבוצות" wide>
          {assigned.length > 0 ? <p className="hint">{assigned.map(groupLabel).join(', ')}</p> : null}
          <GroupAssign subproblemId={sub.id} groups={groups} editable={editable} onChanged={onChanged} />
        </Field>
      </div>
    </article>
  );
}
