'use client';
import { useState } from 'react';
import { toast } from '@/lib/store';
import { addExistingStaff, inviteStaff, type GrantableRole } from '@/lib/ws/staff';
import { dbErrorMessage } from './db-errors';
import { GRANTABLE_ROLE_OPTIONS } from './options';
import styles from './p3.module.css';

interface StaffAddPanelProps {
  onAdded: () => void;
}

const NO_KEY_SERVER_MESSAGE = 'service key not configured';
const NO_KEY_HINT = 'הזמנה במייל תופעל אחרי הגדרת מפתח שירות; בינתיים הוסיפו משתמש שכבר נרשם';
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** Two ways in: attach an existing account, or send an invite (needs the server-side service key). */
export function StaffAddPanel({ onAdded }: StaffAddPanelProps) {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<GrantableRole>('instructor');
  const [busy, setBusy] = useState(false);
  const [inviteOff, setInviteOff] = useState(false);
  const valid = EMAIL.test(email.trim());

  const run = async (action: () => Promise<unknown>, done: string, fail: string) => {
    setBusy(true);
    try {
      await action();
      toast(done, true);
      setEmail('');
      setName('');
      onAdded();
    } catch (err) {
      if (err instanceof Error && err.message === NO_KEY_SERVER_MESSAGE) {
        setInviteOff(true);
      } else {
        toast(err instanceof Error && /[א-ת]/.test(err.message) ? err.message : dbErrorMessage(err, fail));
      }
    } finally {
      setBusy(false);
    }
  };

  const addExisting = () => run(() => addExistingStaff(email, role, name), 'איש הצוות נוסף', 'ההוספה נכשלה');
  const invite = () => run(() => inviteStaff({ email: email.trim(), role, full_name: name.trim() || undefined }),
    'ההזמנה נשלחה', 'שליחת ההזמנה נכשלה');

  return (
    <section className={`hud ${styles.card}`} aria-label="הוספת איש צוות">
      <div className={styles.assign} style={{ marginTop: 0 }}>
        <input type="email" dir="ltr" placeholder="name@example.com" value={email} aria-label="אימייל"
          style={{ width: 'auto', minWidth: 230 }} onChange={(e) => setEmail(e.target.value)} />
        <input type="text" placeholder="שם (לא חובה)" value={name} aria-label="שם" style={{ width: 'auto', minWidth: 160 }}
          onChange={(e) => setName(e.target.value)} />
        <select value={role} aria-label="תפקיד" onChange={(e) => setRole(e.target.value as GrantableRole)}>
          {GRANTABLE_ROLE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <button type="button" className="primary" disabled={busy || !valid} onClick={() => void addExisting()}>
          הוספת משתמש קיים
        </button>
        <button type="button" disabled={busy || !valid || inviteOff} onClick={() => void invite()}>הזמנה במייל</button>
      </div>
      {inviteOff ? <p className={styles.lockNote} role="status">{NO_KEY_HINT}</p> : null}
    </section>
  );
}
