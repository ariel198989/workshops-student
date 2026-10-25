'use client';
import { useMemo, useState } from 'react';
import { toast } from '@/lib/store';
import { addParticipants } from '@/lib/ws/participants';
import { parseRoster } from './groups-utils';
import { errorText } from './hooks';
import styles from './people.module.css';

interface RosterPasteProps {
  workshopId: string;
  /** names already on the list (lower-cased) so the preview can say how many are new */
  existing: ReadonlySet<string>;
  onAdded: () => void;
}

/** One name per line. Signups from the phone app appear on their own after the groups are activated. */
export function RosterPaste({ workshopId, existing, onAdded }: RosterPasteProps) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const names = useMemo(() => parseRoster(text), [text]);
  const fresh = useMemo(() => names.filter((n) => !existing.has(n.toLowerCase())), [names, existing]);

  const submit = async () => {
    setBusy(true);
    try {
      const added = await addParticipants(workshopId, fresh);
      toast(`נוספו ${added.length} משתתפים`, true);
      setText('');
      onAdded();
    } catch (err) {
      toast(errorText(err, 'ההוספה נכשלה'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className={`hud ${styles.paste}`}>
      <label className="lbl" htmlFor="roster-text">הדביקו רשימת שמות, שם בכל שורה</label>
      <textarea id="roster-text" rows={5} value={text} onChange={(e) => setText(e.target.value)} placeholder={'דנה כהן\nיוסי לוי'} />
      <div className={styles.pasteFoot}>
        <span className="hint">
          {names.length === 0 ? 'עדיין אין שמות' : `${fresh.length} חדשים${names.length > fresh.length ? `, ${names.length - fresh.length} כבר ברשימה` : ''}`}
        </span>
        <button type="button" className="primary" disabled={busy || fresh.length === 0} onClick={() => void submit()}>
          הוסף משתתפים
        </button>
      </div>
    </section>
  );
}
