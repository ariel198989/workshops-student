'use client';
import { useState } from 'react';
import { ConfirmButton } from '../ConfirmButton';
import { InlineEdit, type InlineOption } from '../InlineEdit';
import { Pill, StatusPill } from '../StatusPill';
import { labelOf } from '@/lib/ws/labels';
import type { DeliverableWithGroup } from '@/lib/ws/deliverables';
import type { DeliverableStatus } from '@/lib/ws/types';
import { lockSafe, patchDeliverable, reviewSafe } from './api';
import { DemoEvalPanel } from './DemoEvalPanel';
import { FailureCases } from './FailureCases';
import { Field } from './Field';
import { groupLabel } from './labels';
import { ModelSection } from './ModelSection';
import { PresentationField } from './PresentationField';
import { SnapshotSummary } from './SnapshotSummary';
import { readFailureCases } from './validation';
import styles from './p5.module.css';

// "approved" is reached by locking, so the review dropdown offers the other three.
const REVIEW_STATUSES: readonly DeliverableStatus[] = ['in_progress', 'submitted', 'returned'];
const STATUS_OPTIONS: InlineOption[] = REVIEW_STATUSES.map((s) => ({ value: s, label: labelOf('deliverable', s) }));
const isReviewStatus = (v: unknown): v is DeliverableStatus => REVIEW_STATUSES.includes(v as DeliverableStatus);

interface DeliverableCardProps {
  row: DeliverableWithGroup;
  editable: boolean;
  onChanged: () => void;
}

export function DeliverableCard({ row, editable, onChanged }: DeliverableCardProps) {
  const [open, setOpen] = useState(false);
  const locked = row.locked_at !== null;
  const readOnly = locked || !editable;
  const team = row.group.team_name;

  return (
    <article className={`hud card ${styles.deliverable}`}>
      <header className={styles.deliverableHead}>
        <button type="button" className="ghost" aria-expanded={open} onClick={() => setOpen(!open)}>
          <strong>{groupLabel(row.group)}</strong>
          <code dir="ltr">{team}</code>
        </button>
        <span className={styles.metaRow}>
          <StatusPill kind="deliverable" value={row.status} />
          {locked ? <Pill label="נעול" tone="navy" /> : null}
          {row.demo_score !== null ? <span className="pill idle">ציון <span className="num">{row.demo_score}</span></span> : null}
        </span>
      </header>
      {open ? (
        <div className={styles.deliverableBody}>
          {locked ? <SnapshotSummary deliverable={row} /> : null}
          <div className={styles.grid2}>
            <div className="stack">
              {locked ? null : (
                <Field label="סטטוס">
                  <InlineEdit type="select" value={row.status} options={STATUS_OPTIONS} disabled={readOnly}
                    ariaLabel="סטטוס תוצר" display={(v) => <StatusPill kind="deliverable" value={String(v)} />}
                    onSave={async (v) => { if (isReviewStatus(v)) { await reviewSafe(row.id, { status: v }); onChanged(); } }} />
                </Field>
              )}
              <Field label="מודל ותמונות">
                <ModelSection row={row} team={team} disabled={readOnly} onChanged={onChanged} />
              </Field>
              <Field label="מצגת">
                <PresentationField row={row} disabled={readOnly} onChanged={onChanged} />
              </Field>
              <Field label="כשלי מודל">
                <FailureCases team={team} cases={readFailureCases(row.failure_cases)} disabled={readOnly}
                  onChange={async (next) => { await patchDeliverable(row.id, { failure_cases: next }); onChanged(); }} />
              </Field>
            </div>
            <DemoEvalPanel row={row} disabled={readOnly} onChanged={onChanged} />
          </div>
          {locked || !editable ? null : (
            <footer className={styles.lockBar}>
              <ConfirmButton tone="primary" label="נעילת תוצר" confirmText="לנעול? הדאטה והמודל יוקפאו."
                onConfirm={async () => { await lockSafe(row.group_id, row.model_id ?? undefined); onChanged(); }} />
              <span className="hint">הנעילה מסמנת את התוצר כמאושר ומקפיאה את הנתונים.</span>
            </footer>
          )}
        </div>
      ) : null}
    </article>
  );
}
