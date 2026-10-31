'use client';
// /g/<join_token>: the group QR was scanned. One screen, no typing: connect, say hello, go home.
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Spinner } from '@/components/ui/Spinner';
import { joinTokenLogin, type DeviceLoginResult } from '@/lib/student/device-login-flow';
import {
  CONNECTING, INVALID_LINK_FAILURE, isJoinToken, joinLinkFailure, WELCOME_MS, welcomeMessage, type JoinLinkFailure,
} from '@/lib/student/join-token';
import { sessionStorageOrNull, storeEntryHint } from '@/lib/student/pending';
import s from './joinlink.module.css';

type Phase =
  | { kind: 'connecting' }
  | { kind: 'welcome'; label: string }
  | { kind: 'failed'; failure: JoinLinkFailure };

interface Run { key: string; promise: Promise<DeviceLoginResult> }

function Failed({ failure, onRetry, onManual }: { failure: JoinLinkFailure; onRetry: () => void; onManual: () => void }) {
  return (
    <>
      <h1 className={s.h1}>{failure.message}</h1>
      <div className={s.actions}>
        {failure.retry ? (
          <button type="button" className={`${s.btn} ${s.btnPrimary}`} onClick={onRetry}>נסו שוב</button>
        ) : null}
        {failure.manual ? (
          <button type="button" className={s.btn} onClick={onManual}>כניסה עם קוד ו-PIN</button>
        ) : null}
      </div>
    </>
  );
}

/** Validates the token shape first; a bad link never calls the server. */
export function JoinLink({ token }: { token: string }) {
  const router = useRouter();
  const valid = isJoinToken(token);
  const [attempt, setAttempt] = useState(0);
  const [phase, setPhase] = useState<Phase>(() => (valid ? { kind: 'connecting' } : { kind: 'failed', failure: INVALID_LINK_FAILURE }));
  const run = useRef<Run | null>(null);

  useEffect(() => {
    if (!valid) return;
    // one sign-in per attempt, even when React mounts the effect twice in development
    const key = `${token}:${attempt}`;
    if (!run.current || run.current.key !== key) run.current = { key, promise: joinTokenLogin(token) };
    let current = true;
    setPhase({ kind: 'connecting' });
    run.current.promise
      .then(({ group }) => { if (current) setPhase({ kind: 'welcome', label: group.label }); })
      .catch((err: unknown) => { if (current) setPhase({ kind: 'failed', failure: joinLinkFailure(err) }); });
    return () => { current = false; };
  }, [token, valid, attempt]);

  useEffect(() => {
    if (phase.kind !== 'welcome') return;
    const timer = setTimeout(() => router.replace('/'), WELCOME_MS);
    return () => clearTimeout(timer);
  }, [phase.kind, router]);

  const manual = () => {
    storeEntryHint(sessionStorageOrNull(), 'pin');
    router.push('/');
  };

  return (
    <main className={s.screen}>
      <section className={s.card} aria-live="polite">
        <span className={s.brand}>Workshops</span>
        {phase.kind === 'connecting' ? (
          <>
            <Spinner large label={CONNECTING} />
            <h1 className={s.h1}>{CONNECTING}</h1>
          </>
        ) : phase.kind === 'welcome' ? (
          <>
            <span className={s.check} aria-hidden="true">✓</span>
            <h1 className={s.h1}>{welcomeMessage(phase.label)}</h1>
          </>
        ) : (
          <Failed failure={phase.failure} onRetry={() => setAttempt((a) => a + 1)} onManual={manual} />
        )}
      </section>
    </main>
  );
}
