'use client';
import { useState, type DragEvent, type ReactNode } from 'react';
import { Pill, StatusPill } from '@/components/ws/StatusPill';
import { toast } from '@/lib/store';
import type { ParticipantWithGroup } from '@/lib/ws/participants';
import type { OverviewGroup } from '@/lib/ws/types';
import { MEMBER_MIME, encodeMemberDrag } from './drag';
import { formatAccuracy } from './readiness';
import styles from './board.module.css';

/** Monospace team_name chip with a copy button (team names are shared with the phone app, never edited here). */
export function TeamChip({ name, copyable }: { name: string; copyable: boolean }) {
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(name);
      toast('שם הקבוצה הועתק', true);
    } catch {
      toast('ההעתקה נכשלה');
    }
  };
  return (
    <div className={styles.team}>
      <span className={styles.teamChip} title={name}>{name}</span>
      {copyable ? <button type="button" className={`ghost ${styles.copy}`} onClick={() => void copy()}>העתק</button> : null}
    </div>
  );
}

interface MemberChipProps {
  person: ParticipantWithGroup;
  draggable: boolean;
}

export function MemberChip({ person, draggable }: MemberChipProps) {
  const [dragging, setDragging] = useState(false);
  const onStart = (e: DragEvent) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData(MEMBER_MIME, encodeMemberDrag({ participantId: person.id, fromGroupId: person.group_id }));
    setDragging(true);
  };
  const linked = person.user_id !== null;
  return (
    <span className={`${styles.member} ${draggable ? '' : styles.memberStatic} ${dragging ? styles.memberDragging : ''}`}
      draggable={draggable} onDragStart={draggable ? onStart : undefined} onDragEnd={() => setDragging(false)}
      title={linked ? 'מחובר/ת לאפליקציה' : 'עדיין לא נרשם/ה באפליקציה'}>
      <span className={linked ? styles.linked : styles.unlinked} aria-hidden="true" />
      {person.full_name}
    </span>
  );
}

const JOB_PARTS = [
  ['pending', 'ממתינים'],
  ['running', 'רצים'],
  ['done', 'הושלמו'],
] as const;

function Line({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className={styles.line}>
      <span className={styles.lineLbl}>{label}</span>
      {children}
    </div>
  );
}

/** Jobs, best model, attendance and deliverable as short labelled lines. */
export function StatusLines({ group }: { group: OverviewGroup }) {
  const { jobs, model, deliverable, attendance_rate: rate } = group;
  const anyJobs = jobs.pending + jobs.running + jobs.done > 0;
  const acc = model ? formatAccuracy(model.accuracy) : null;
  return (
    <div className={styles.lines}>
      <Line label="אימונים">
        {anyJobs
          ? <span>{JOB_PARTS.map(([k, label]) => `${label} ${jobs[k]}`).join(' · ')}</span>
          : <span className={styles.muted}>אין אימונים עדיין</span>}
      </Line>
      <Line label="מודל">
        {model ? (
          <>
            <span>{model.name}{acc ? `, ${acc}` : ''}</span>
            {model.approved ? <Pill label="מאושר" tone="teal" /> : null}
            {model.personal ? <Pill label="אישי" tone="outline" /> : null}
          </>
        ) : <span className={styles.muted}>אין מודל עדיין</span>}
      </Line>
      <Line label="נוכחות">
        {rate === null ? <span className={styles.muted}>לא נלקחה</span> : <span>{Math.round(rate * 100)}%</span>}
      </Line>
      <Line label="תוצר">
        {deliverable
          ? <><StatusPill kind="deliverable" value={deliverable.status} />{deliverable.locked ? <Pill label="נעול" tone="navy" /> : null}</>
          : <span className={styles.muted}>טרם נוצר</span>}
      </Line>
    </div>
  );
}
