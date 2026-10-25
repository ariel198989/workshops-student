'use client';
import { useState, type DragEvent } from 'react';
import { InlineEdit, type InlineOption } from '@/components/ws/InlineEdit';
import { Pill } from '@/components/ws/StatusPill';
import type { ParticipantWithGroup } from '@/lib/ws/participants';
import type { GroupPatch, OverviewGroup, TaskType, WsSubproblem } from '@/lib/ws/types';
import { CoverageList } from './CoverageList';
import { MEMBER_MIME, parseMemberDrag } from './drag';
import { MemberChip, StatusLines, TeamChip } from './GroupCardParts';
import { ReadinessBar } from './ReadinessBar';
import { tierLabel } from './readiness';
import styles from './board.module.css';

const TASK_LABELS: Record<TaskType, string> = { detect: 'זיהוי', classify: 'סיווג', count: 'ספירה', other: 'אחר' };
const TIER_TONE = { red: 'red', ok: 'amber', strong: 'green' } as const;
const text = (v: string | number | null): string | null => (v === null || v === '' ? null : String(v));

interface GroupCardProps {
  group: OverviewGroup;
  members: readonly ParticipantWithGroup[];
  subproblems: readonly WsSubproblem[];
  canEdit: boolean;
  /** big-type read-only rendering for the classroom projector */
  projector?: boolean;
  onMove: (participantId: string, groupId: string) => void;
  onPatch: (groupId: string, patch: GroupPatch) => Promise<void>;
}

function SubproblemLine({ group, subproblems, editable, onPatch }: {
  group: OverviewGroup; subproblems: readonly WsSubproblem[]; editable: boolean;
  onPatch: (patch: GroupPatch) => Promise<void>;
}) {
  const options: InlineOption[] = subproblems.map((s) => ({ value: s.id, label: s.title }));
  const sub = group.subproblem;
  return (
    <div className={styles.sub}>
      <InlineEdit type="select" value={sub?.id ?? null} options={options} disabled={!editable}
        placeholder={editable ? 'שייכו תת-בעיה' : 'אין תת-בעיה'} ariaLabel="תת-בעיה"
        display={() => <span className={styles.subTitle}>{sub?.title ?? null}</span>}
        onSave={(v) => onPatch({ subproblem_id: text(v) })} />
      {sub ? <Pill label={TASK_LABELS[sub.task_type]} tone="blue" /> : null}
    </div>
  );
}

export function GroupCard({ group, members, subproblems, canEdit, projector = false, onMove, onPatch }: GroupCardProps) {
  const [over, setOver] = useState(false);
  const editable = canEdit && !projector;
  // the server's readiness is the worst class (min tagged), same thresholds as ReadinessBar
  const tier = group.readiness === 'no_targets' ? null : group.readiness;
  const linked = members.filter((m) => m.user_id !== null).length;
  const patch = (change: GroupPatch) => onPatch(group.group_id, change);

  const accepts = (e: DragEvent) => editable && e.dataTransfer.types.includes(MEMBER_MIME);
  const onDrop = (e: DragEvent) => {
    setOver(false);
    if (!accepts(e)) return;
    e.preventDefault();
    const drag = parseMemberDrag(e.dataTransfer.getData(MEMBER_MIME));
    if (drag && drag.fromGroupId !== group.group_id) onMove(drag.participantId, group.group_id);
  };

  return (
    <article className={`${styles.card} ${over ? styles.cardOver : ''}`} aria-label={`קבוצה ${group.number}`}
      onDragOver={(e) => { if (accepts(e)) { e.preventDefault(); setOver(true); } }}
      onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOver(false); }}
      onDrop={onDrop}>
      <header className={styles.head}>
        <span className={styles.no}>{group.number}</span>
        <div className={styles.name}>
          <InlineEdit value={group.display_name} disabled={!editable} placeholder={editable ? 'שם לקבוצה' : `קבוצה ${group.number}`}
            ariaLabel="שם הקבוצה" onSave={(v) => patch({ display_name: text(v) })} />
        </div>
        {!group.activated ? <Pill label="לא הופעלה" tone="amber" /> : null}
        {tier ? <Pill label={tierLabel(tier)} tone={TIER_TONE[tier]} /> : null}
      </header>

      <TeamChip name={group.team_name} copyable={!projector} />
      <SubproblemLine group={group} subproblems={subproblems} editable={editable} onPatch={patch} />

      <dl className={styles.facts}>
        {[['תמונות', group.photos], ['מתויגות', group.tagged], ['לא מתויגות', group.untagged], ['היום', group.today]].map(([label, value]) => (
          <div key={label} className={styles.fact}>
            <dt className={styles.factLbl}>{label}</dt>
            <dd className={styles.factVal}>{value}</dd>
          </div>
        ))}
      </dl>

      <ReadinessBar coverage={group.coverage} readiness={group.readiness} />
      <CoverageList offTarget={group.off_target_classes} />
      <StatusLines group={group} />

      <div>
        <p className={styles.people}>{members.length} חברים, {linked} מחוברים לאפליקציה</p>
        <div className={styles.members}>
          {members.length === 0 ? <span className={styles.emptyMembers}>{editable ? 'גררו לכאן תלמידים' : 'אין חברים'}</span> : null}
          {members.map((m) => <MemberChip key={m.id} person={m} draggable={editable} />)}
        </div>
      </div>
    </article>
  );
}
