'use client';
import { useEffect, useState, type FormEvent } from 'react';
import { findWorkshop, type FoundWorkshop } from '@/lib/student/join';
import { isCodeComplete, normalizeCode } from '@/lib/student/code';
import { TextField } from './TextField';
import k from './kit.module.css';
import j from './join.module.css';

const NOT_FOUND = 'הקוד לא נמצא או שהסדנה עוד לא נפתחה';

/** The code that came in from a link or a QR, with one way out of it. */
export function CodeChip({ code, onChange }: { code: string; onChange: () => void }) {
  return (
    <div className={j.codeRow}>
      <span className={`${k.chip} ${j.codeChip}`} dir="ltr">{code}</span>
      <button type="button" className={j.linkBtn} onClick={onChange}>שינוי קוד</button>
    </div>
  );
}

interface CodeStepProps {
  /** what the field starts with (a code scanned from a QR, or the one the student just left) */
  initialCode?: string;
  /** look the initial code up at once instead of waiting for a tap */
  autoLookup?: boolean;
  onFound: (code: string, workshop: FoundWorkshop) => void;
}

/** Step 1: the code the instructor gave out, e.g. OFEK-H2-27. */
export function CodeStep({ initialCode = '', autoLookup = false, onFound }: CodeStepProps) {
  const [code, setCode] = useState(initialCode);
  const [auto, setAuto] = useState(autoLookup && isCodeComplete(normalizeCode(initialCode)));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!auto) return;
    let current = true;
    const clean = normalizeCode(initialCode);
    findWorkshop(clean)
      .then((found) => {
        if (!current) return;
        if (found) onFound(clean, found);
        else { setError(NOT_FOUND); setAuto(false); }
      })
      .catch((err: unknown) => {
        if (!current) return;
        setError(err instanceof Error ? err.message : NOT_FOUND);
        setAuto(false);
      });
    return () => { current = false; };
  }, [auto, initialCode, onFound]);

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

  if (auto) {
    return (
      <div className={k.stack} aria-live="polite">
        <h1 className={k.h1}>מצטרפים לסדנה</h1>
        <CodeChip code={normalizeCode(initialCode)} onChange={() => setAuto(false)} />
        <p className={k.lead}>מחפשים את הסדנה...</p>
      </div>
    );
  }

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
