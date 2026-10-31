'use client';
import { useRouter } from 'next/navigation';
import { useEffect, useReducer, useState, type FormEvent } from 'react';
import { isCodeComplete, normalizeCode } from '@/lib/student/code';
import { EMPTY_PIN, GROUP_NUMBERS, pinComplete, pinReducer } from '@/lib/student/device-login';
import { deviceLogin } from '@/lib/student/device-login-flow';
import { PinPad } from './PinPad';
import { TextField } from './TextField';
import k from './kit.module.css';
import gl from './group-login.module.css';

type Step = 'code' | 'group' | 'pin';

/** Step 1: the workshop code, same field as the join flow (no lookup: the tablet is not signed in yet). */
function CodeField({ onNext }: { onNext: (code: string) => void }) {
  const [code, setCode] = useState('');
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const clean = normalizeCode(code);
    if (isCodeComplete(clean)) onNext(clean);
  };
  return (
    <form onSubmit={submit}>
      <TextField label="קוד הסדנה" type="text" dir="ltr" inputMode="text" autoCapitalize="characters" autoFocus
        autoComplete="off" autoCorrect="off" spellCheck={false} placeholder="OFEK-H2-27" inputClassName={k.codeInput}
        value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} />
      <button type="submit" className={`${k.btn} ${k.btnPrimary}`} disabled={!isCodeComplete(normalizeCode(code))}>המשך</button>
    </form>
  );
}

/** Step 2: 1..12 as big tappable numbers. */
function GroupGrid({ onPick }: { onPick: (n: number) => void }) {
  return (
    <div className={gl.grid} role="group" aria-label="מספר הקבוצה">
      {GROUP_NUMBERS.map((n) => (
        <button key={n} type="button" className={gl.num} onClick={() => onPick(n)} aria-label={`קבוצה ${n}`}>{n}</button>
      ))}
    </div>
  );
}

interface Props { onBack: () => void }

/** כניסת קבוצה: code → group → PIN. On success the auth gate takes over and the group lands on the home screen. */
export function GroupLogin({ onBack }: Props) {
  const router = useRouter();
  const [step, setStep] = useState<Step>('code');
  const [code, setCode] = useState('');
  const [group, setGroup] = useState<number | null>(null);
  const [pin, dispatch] = useReducer(pinReducer, EMPTY_PIN);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (step !== 'pin' || group === null || busy || !pinComplete(pin)) return;
    let current = true;
    setBusy(true);
    setError('');
    deviceLogin({ code, group, pin: pin.digits })
      .then(() => { if (current) router.replace('/'); })
      .catch((err: unknown) => {
        if (!current) return;
        setError(err instanceof Error ? err.message : 'משהו השתבש. נסו שוב בעוד רגע');
        dispatch({ type: 'clear' });
        setBusy(false);
      });
    return () => { current = false; };
    // runs once per completed PIN; `busy` is set inside the effect itself
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pin, step, group, code, router]);

  const back = () => {
    setError('');
    dispatch({ type: 'clear' });
    if (step === 'code') onBack();
    else if (step === 'group') setStep('code');
    else setStep('group');
  };

  return (
    <div className={k.stack}>
      <div>
        <h2 className={k.h1}>כניסת קבוצה</h2>
        <p className={k.lead}>
          {step === 'code' ? 'כתבו את קוד הסדנה שעל הלוח.' : step === 'group' ? 'איזו קבוצה אתם?' : `קבוצה ${group}: הקלידו את הקוד הסודי שקיבלתם מהמדריך.`}
        </p>
      </div>
      {step === 'code' ? <CodeField onNext={(c) => { setCode(c); setStep('group'); }} /> : null}
      {step === 'group' ? <GroupGrid onPick={(n) => { setGroup(n); setStep('pin'); }} /> : null}
      {step === 'pin' ? <PinPad pin={pin} dispatch={dispatch} disabled={busy} /> : null}
      <p className={k.error} role="alert">{busy ? 'נכנסים...' : error}</p>
      <button type="button" className={`${k.btn} ${k.btnGhost}`} onClick={back} disabled={busy}>
        {step === 'code' ? 'חזרה' : step === 'group' ? 'חזרה לקוד' : 'חזרה לקבוצות'}
      </button>
    </div>
  );
}
