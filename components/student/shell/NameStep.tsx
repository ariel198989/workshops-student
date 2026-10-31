'use client';
import { useEffect, useState, type FormEvent } from 'react';
import { sb } from '@/lib/db';
import { isDeviceEmail, prefillName } from '@/lib/student/device-account';
import { validateJoinName } from '@/lib/student/labels';
import type { FoundGroup } from '@/lib/student/join';
import { TextField } from './TextField';
import k from './kit.module.css';

interface NameStepProps {
  group: FoundGroup;
  /** the student came in with the spoken workshop number: ask for a first name in the singular */
  child?: boolean;
  busy: boolean;
  error: string;
  onConfirm: (fullName: string) => void;
  onBack: () => void;
}

/**
 * Step 3: the name and the join. Account holders get their sign-up name prefilled; a device account
 * (placeholder name תלמיד/ה) starts empty and the child types a first name.
 */
export function NameStep({ group, child = false, busy, error, onConfirm, onBack }: NameStepProps) {
  const [name, setName] = useState('');
  const [problem, setProblem] = useState('');
  const [device, setDevice] = useState(false);

  useEffect(() => {
    let current = true;
    void sb.auth.getSession().then(({ data }) => {
      if (!current) return;
      const user = data.session?.user;
      setDevice(isDeviceEmail(user?.email));
      const meta = prefillName(user?.user_metadata?.full_name, user?.email);
      if (meta) setName((prev) => prev || meta);
    });
    return () => { current = false; };
  }, []);

  const kid = child || device;
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const invalid = validateJoinName(name, kid);
    setProblem(invalid ?? '');
    if (!invalid) onConfirm(name.trim());
  };

  const label = group.display_name?.trim() ? `קבוצה ${group.number} · ${group.display_name.trim()}` : `קבוצה ${group.number}`;
  return (
    <form onSubmit={submit} noValidate>
      <h1 className={k.h1}>כמעט שם</h1>
      <p className={k.lead} style={{ margin: '8px 0 20px' }}>
        מצטרפים אל <b>{label}</b>.{kid ? '' : ' איך קוראים לכם?'}
      </p>
      {kid ? (
        <TextField label="איך קוראים לך?" type="text" autoComplete="given-name" placeholder="שם פרטי" required autoFocus
          value={name} onChange={(e) => setName(e.target.value)} />
      ) : (
        <TextField label="שם מלא" type="text" autoComplete="name" required value={name}
          onChange={(e) => setName(e.target.value)} />
      )}
      <p className={k.error} role="alert">{problem || error}</p>
      <div className={k.stack}>
        <button type="submit" className={`${k.btn} ${k.btnPrimary}`} disabled={busy}>
          {busy ? 'מצרפים...' : 'מצטרפים לקבוצה'}
        </button>
        <button type="button" className={`${k.btn} ${k.btnGhost}`} onClick={onBack} disabled={busy}>
          בחירת קבוצה אחרת
        </button>
      </div>
    </form>
  );
}
