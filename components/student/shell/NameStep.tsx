'use client';
import { useEffect, useState, type FormEvent } from 'react';
import { sb } from '@/lib/db';
import { validateJoinName } from '@/lib/student/labels';
import type { FoundGroup } from '@/lib/student/join';
import { TextField } from './TextField';
import k from './kit.module.css';

interface NameStepProps {
  group: FoundGroup;
  busy: boolean;
  error: string;
  onConfirm: (fullName: string) => void;
  onBack: () => void;
}

/** Step 3: confirm the full name (prefilled from sign up) and join. */
export function NameStep({ group, busy, error, onConfirm, onBack }: NameStepProps) {
  const [name, setName] = useState('');
  const [problem, setProblem] = useState('');

  useEffect(() => {
    let current = true;
    void sb.auth.getSession().then(({ data }) => {
      const meta = data.session?.user.user_metadata?.full_name;
      if (current && typeof meta === 'string') setName((prev) => prev || meta);
    });
    return () => { current = false; };
  }, []);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const invalid = validateJoinName(name);
    setProblem(invalid ?? '');
    if (!invalid) onConfirm(name.trim());
  };

  const label = group.display_name?.trim() ? `קבוצה ${group.number} · ${group.display_name.trim()}` : `קבוצה ${group.number}`;
  return (
    <form onSubmit={submit} noValidate>
      <h1 className={k.h1}>כמעט שם</h1>
      <p className={k.lead} style={{ margin: '8px 0 20px' }}>מצטרפים אל <b>{label}</b>. איך קוראים לכם?</p>
      <TextField label="שם מלא" type="text" autoComplete="name" required value={name}
        onChange={(e) => setName(e.target.value)} />
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
