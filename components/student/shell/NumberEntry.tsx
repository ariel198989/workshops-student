'use client';
// The first screen for a signed-out child: "מה מספר הסדנה?", four boxes, a keypad. The 4th digit submits.
// Success signs this phone in as its own device account and hands the number to /join (group → name → home).
import { useRouter } from 'next/navigation';
import { useEffect, useReducer, useState } from 'react';
import { Spinner } from '@/components/ui/Spinner';
import { EMPTY_PIN, pinComplete, pinReducer } from '@/lib/student/device-login';
import { getOrCreateDeviceId, localStorageOrNull } from '@/lib/student/device-id';
import { numberLogin } from '@/lib/student/device-login-flow';
import { NUMBER_SUB, NUMBER_TITLE } from '@/lib/student/entry';
import { numberLoginFailureMessage, SEARCHING, WORKSHOP_NUMBER_LENGTH } from '@/lib/student/number-login';
import { clearPendingCode, sessionStorageOrNull, storePendingCode } from '@/lib/student/pending';
import { PinPad } from './PinPad';
import ne from './number-entry.module.css';

const JOIN_PATH = '/join';

/** Stores the number first so a reload mid-sign-in still lands in the join flow, then signs the device in. */
async function enterWithNumber(number: string): Promise<void> {
  const session = sessionStorageOrNull();
  storePendingCode(session, number);
  try {
    await numberLogin(number, getOrCreateDeviceId(localStorageOrNull()));
  } catch (err) {
    clearPendingCode(session); // a wrong number must not auto-look itself up after a reload
    throw err;
  }
}

export function NumberEntry() {
  const router = useRouter();
  const [pin, dispatch] = useReducer(pinReducer, EMPTY_PIN);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (busy || !pinComplete(pin)) return;
    let current = true;
    setBusy(true);
    setError('');
    enterWithNumber(pin.digits)
      .then(() => { if (current) router.replace(JOIN_PATH); })
      .catch((err: unknown) => {
        if (!current) return;
        setError(numberLoginFailureMessage(err));
        dispatch({ type: 'clear' });
        setBusy(false);
      });
    return () => { current = false; };
    // runs once per completed number; `busy` is set inside the effect itself
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pin, router]);

  return (
    <div className={ne.wrap}>
      <h2 className={ne.title}>{NUMBER_TITLE}</h2>
      <p className={ne.sub}>{NUMBER_SUB}</p>
      <PinPad pin={pin} dispatch={dispatch} disabled={busy} digits={WORKSHOP_NUMBER_LENGTH} reveal large />
      <p className={error ? `${ne.status} ${ne.statusError}` : ne.status} role="alert">
        {busy ? <><Spinner label={SEARCHING} />{SEARCHING}</> : error}
      </p>
    </div>
  );
}
