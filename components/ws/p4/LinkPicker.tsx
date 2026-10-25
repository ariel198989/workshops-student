'use client';
import { Drawer } from '@/components/ws/Drawer';
import { ConfirmButton } from '@/components/ws/ConfirmButton';
import { toast } from '@/lib/store';
import { linkParticipant, type ParticipantWithGroup } from '@/lib/ws/participants';
import { linkArgs, linkCandidates } from './link-utils';
import styles from './people.module.css';

interface LinkPickerProps {
  /** the row the instructor started from; null = closed */
  base: ParticipantWithGroup | null;
  rows: readonly ParticipantWithGroup[];
  onClose: () => void;
  onLinked: () => void;
}

/** Merge UX: pick the account/roster row that is the same student. */
export function LinkPicker({ base, rows, onClose, onLinked }: LinkPickerProps) {
  const candidates = base ? linkCandidates(base, rows) : [];

  const link = async (other: ParticipantWithGroup) => {
    const args = base ? linkArgs(base, other) : null;
    if (!args) {
      toast('אי אפשר לקשר את השניים');
      return;
    }
    await linkParticipant(args.participantId, args.userId);
    toast('התלמיד קושר לחשבון', true);
    onLinked();
    onClose();
  };

  return (
    <Drawer open={base !== null} title={base ? `זה אותו תלמיד? ${base.full_name}` : ''} onClose={onClose}>
      {candidates.length === 0 ? (
        <p className="hint">אין התאמות. תלמידים שנרשמו באפליקציה ועדיין לא מתאימים לרשימה יופיעו כאן.</p>
      ) : (
        <ul className={styles.candidates}>
          {candidates.map((c) => (
            <li key={c.id}>
              <span>
                <b>{c.full_name}</b>
                <span className="hint"> {c.group ? `קבוצה ${c.group.number}` : 'בלי קבוצה'}</span>
              </span>
              <ConfirmButton label="זה אותו תלמיד" confirmText="לקשר ולאחד?" tone="primary" small onConfirm={() => link(c)} />
            </li>
          ))}
        </ul>
      )}
    </Drawer>
  );
}
