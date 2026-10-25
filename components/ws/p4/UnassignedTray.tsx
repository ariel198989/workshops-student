'use client';
import { useState, type DragEvent } from 'react';
import type { ParticipantWithGroup } from '@/lib/ws/participants';
import { MEMBER_MIME, parseMemberDrag } from './drag';
import { MemberChip } from './GroupCardParts';
import styles from './board.module.css';

interface UnassignedTrayProps {
  people: readonly ParticipantWithGroup[];
  canEdit: boolean;
  /** null = take the student out of any group */
  onMove: (participantId: string, groupId: string | null) => void;
}

/** Students without a group. Also the drop zone for taking someone out of a group. */
export function UnassignedTray({ people, canEdit, onMove }: UnassignedTrayProps) {
  const [over, setOver] = useState(false);
  if (people.length === 0 && !canEdit) return null;

  const accepts = (e: DragEvent) => canEdit && e.dataTransfer.types.includes(MEMBER_MIME);
  const onDrop = (e: DragEvent) => {
    setOver(false);
    if (!accepts(e)) return;
    e.preventDefault();
    const drag = parseMemberDrag(e.dataTransfer.getData(MEMBER_MIME));
    if (drag && drag.fromGroupId !== null) onMove(drag.participantId, null);
  };

  return (
    <section className={`${styles.tray} ${over ? styles.trayOver : ''}`} aria-label="תלמידים בלי קבוצה"
      onDragOver={(e) => { if (accepts(e)) { e.preventDefault(); setOver(true); } }}
      onDragLeave={() => setOver(false)} onDrop={onDrop}>
      <span className={styles.trayLbl}>בלי קבוצה ({people.length})</span>
      {people.map((p) => <MemberChip key={p.id} person={p} draggable={canEdit} />)}
      {people.length === 0 ? <span className={styles.trayHint}>גררו לכאן כדי להוציא תלמיד מקבוצה</span> : null}
    </section>
  );
}
