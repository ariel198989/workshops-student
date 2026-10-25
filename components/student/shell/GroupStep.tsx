'use client';
import type { FoundGroup, FoundWorkshop } from '@/lib/student/join';
import k from './kit.module.css';
import j from './join.module.css';

const isFull = (g: FoundGroup): boolean => g.capacity !== null && g.members >= g.capacity;

function memberText(g: FoundGroup): string {
  if (isFull(g)) return 'הקבוצה מלאה';
  return g.capacity === null ? `${g.members} חברים` : `${g.members} מתוך ${g.capacity} חברים`;
}

interface GroupStepProps {
  workshop: FoundWorkshop;
  onPick: (group: FoundGroup) => void;
  onBack: () => void;
}

/** Step 2: the workshop that was found and its groups, one big tap target per group. */
export function GroupStep({ workshop, onPick, onBack }: GroupStepProps) {
  return (
    <div className={k.stack}>
      <div>
        <h1 className={k.h1}>{workshop.title}</h1>
        {workshop.organization ? <p className={k.lead}>{workshop.organization}</p> : null}
      </div>
      <h2 className={k.h2}>באיזו קבוצה אתם?</h2>
      {workshop.groups.length === 0 ? (
        <p className={k.lead}>עוד לא נפתחו קבוצות בסדנה הזאת. שאלו את המדריך.</p>
      ) : (
        <ul className={j.groups}>
          {workshop.groups.map((g) => (
            <li key={g.id}>
              <button type="button" className={j.group} disabled={isFull(g)} onClick={() => onPick(g)}>
                <span className={j.num}>{g.number}</span>
                <span className={j.groupText}>
                  <b>{g.display_name?.trim() || `קבוצה ${g.number}`}</b>
                  <span>{memberText(g)}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <button type="button" className={`${k.btn} ${k.btnGhost}`} onClick={onBack}>חזרה לקוד</button>
    </div>
  );
}
