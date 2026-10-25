'use client';
import { useState, type FormEvent } from 'react';
import { findWorkshop, type FoundWorkshop } from '@/lib/student/join';
import { isCodeComplete, normalizeCode } from '@/lib/student/code';
import { TextField } from './TextField';
import k from './kit.module.css';

const NOT_FOUND = 'הקוד לא נמצא או שהסדנה עוד לא נפתחה';

/** Step 1: the code the instructor gave out, e.g. OFEK-H2-27. */
export function CodeStep({ onFound }: { onFound: (code: string, workshop: FoundWorkshop) => void }) {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const clean = normalizeCode(code);
      const found = await findWorkshop(clean);
      if (found) onFound(clean, found);
      else setError(NOT_FOUND);
    } catch (err) {
      setError(err instanceof Error ? err.message : NOT_FOUND);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit}>
      <h1 className={k.h1}>מצטרפים לסדנה</h1>
      <p className={k.lead} style={{ margin: '8px 0 20px' }}>
        כתבו את הקוד שקיבלתם מהמדריך.
      </p>
      <TextField label="קוד הסדנה" type="text" dir="ltr" inputMode="text" autoCapitalize="characters"
        autoComplete="off" autoCorrect="off" spellCheck={false} placeholder="OFEK-H2-27" inputClassName={k.codeInput}
        value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} />
      <p className={k.error} role="alert">{error}</p>
      <button type="submit" className={`${k.btn} ${k.btnPrimary}`} disabled={busy || !isCodeComplete(normalizeCode(code))}>
        {busy ? 'מחפשים...' : 'המשך'}
      </button>
    </form>
  );
}
