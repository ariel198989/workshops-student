'use client';
import { useState, type FormEvent } from 'react';
import { login } from '@/lib/auth';
import { TextField } from './TextField';
import k from './kit.module.css';

/** Email + password sign in, shared by staff and students. */
export function StudentLogin() {
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await login(email.trim(), pass);
    } catch {
      setError('האימייל או הסיסמה לא נכונים. נסו שוב');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit}>
      <TextField label="אימייל" type="email" autoComplete="email" inputMode="email" dir="ltr" required
        value={email} onChange={(e) => setEmail(e.target.value)} />
      <TextField label="סיסמה" type="password" autoComplete="current-password" dir="ltr" required
        value={pass} onChange={(e) => setPass(e.target.value)} />
      <p className={k.error} role="alert">{error}</p>
      <button type="submit" className={`${k.btn} ${k.btnPrimary}`} disabled={busy || !email || !pass}>
        {busy ? 'מתחבר...' : 'כניסה'}
      </button>
    </form>
  );
}
