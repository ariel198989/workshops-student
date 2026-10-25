'use client';
import { useState, type FormEvent } from 'react';
import { studentSignup } from '@/lib/student/auth';
import { MIN_PASSWORD, validateSignup } from '@/lib/student/labels';
import { TextField } from './TextField';
import k from './kit.module.css';

/** Student sign up. Accounts are auto-confirmed, so success signs in and the route guard sends the student to /student/join. */
export function StudentSignup() {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const input = { fullName, email, password };
    const problem = validateSignup(input);
    if (problem) {
      setError(problem);
      return;
    }
    setBusy(true);
    setError('');
    try {
      await studentSignup(input);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'משהו השתבש. נסו שוב בעוד רגע');
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} noValidate>
      <TextField label="שם מלא" type="text" autoComplete="name" required
        value={fullName} onChange={(e) => setFullName(e.target.value)} />
      <TextField label="אימייל" type="email" autoComplete="email" inputMode="email" dir="ltr" required
        value={email} onChange={(e) => setEmail(e.target.value)} />
      <TextField label={`סיסמה (לפחות ${MIN_PASSWORD} תווים)`} type="password" autoComplete="new-password" dir="ltr"
        required minLength={MIN_PASSWORD} value={password} onChange={(e) => setPassword(e.target.value)} />
      <p className={k.error} role="alert">{error}</p>
      <button type="submit" className={`${k.btn} ${k.btnPrimary}`} disabled={busy}>
        {busy ? 'יוצר חשבון...' : 'יצירת חשבון'}
      </button>
    </form>
  );
}
