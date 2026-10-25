'use client';
import { InlineEdit, type InlineOption } from '../InlineEdit';
import { StatusPill } from '../StatusPill';
import { labelOf } from '@/lib/ws/labels';
import { PROBLEM_STATUSES, type ProblemStatus, type WsProblem } from '@/lib/ws/types';
import { patchProblem, type ProblemPatch } from './api';
import { Field } from './Field';
import { asText, requiredText } from './labels';
import styles from './p5.module.css';

type TextKey = 'client_name' | 'client_contact' | 'title' | 'statement' | 'context' | 'success_criteria';
interface TextField { key: TextKey; label: string; multiline: boolean; required: boolean }

const FIELDS: readonly TextField[] = [
  { key: 'client_name', label: 'לקוח', multiline: false, required: false },
  { key: 'client_contact', label: 'איש קשר', multiline: false, required: false },
  { key: 'title', label: 'כותרת', multiline: false, required: true },
  { key: 'statement', label: 'הגדרת הבעיה', multiline: true, required: true },
  { key: 'context', label: 'הקשר', multiline: true, required: false },
  { key: 'success_criteria', label: 'קריטריוני הצלחה', multiline: true, required: false },
];

const STATUS_OPTIONS: InlineOption[] = PROBLEM_STATUSES.map((s) => ({ value: s, label: labelOf('problem', s) }));
const isStatus = (v: unknown): v is ProblemStatus => PROBLEM_STATUSES.includes(v as ProblemStatus);

interface ProblemCardProps {
  problem: WsProblem;
  editable: boolean;
  onChanged: () => void;
}

/** The workshop's primary mega-problem; every field edits in place. */
export function ProblemCard({ problem, editable, onChanged }: ProblemCardProps) {
  const save = async (patch: ProblemPatch) => {
    await patchProblem(problem.id, patch);
    onChanged();
  };

  return (
    <section className={`hud card ${styles.problemCard}`}>
      <header className={styles.cardHead}>
        <h2 className={styles.cardTitle}>בעיית-על</h2>
        <InlineEdit type="select" value={problem.status} options={STATUS_OPTIONS} disabled={!editable}
          ariaLabel="סטטוס בעיה"
          display={(v) => <StatusPill kind="problem" value={String(v)} />}
          onSave={(v) => { if (isStatus(v)) return save({ status: v }); }} />
      </header>
      <div className={styles.grid2}>
        {FIELDS.map((f) => (
          <Field key={f.key} label={f.label} wide={f.multiline}>
            <InlineEdit type={f.multiline ? 'textarea' : 'text'} value={problem[f.key]} disabled={!editable}
              ariaLabel={f.label}
              onSave={(v) => save({ [f.key]: f.required ? requiredText(v) : asText(v) } as ProblemPatch)} />
          </Field>
        ))}
      </div>
    </section>
  );
}
