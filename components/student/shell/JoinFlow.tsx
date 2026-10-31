'use client';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { useStudentContext } from '@/lib/student/context';
import { joinGroup, refreshAfterJoin, type FoundGroup, type FoundWorkshop } from '@/lib/student/join';
import { isWorkshopNumber } from '@/lib/student/number-login';
import { clearPendingCode, codeFromSearch, peekPendingCode, sessionStorageOrNull } from '@/lib/student/pending';
import { CodeChip, CodeStep } from './CodeStep';
import { GroupStep } from './GroupStep';
import { NameStep } from './NameStep';
import k from './kit.module.css';
import j from './join.module.css';

interface Found { code: string; workshop: FoundWorkshop }

/**
 * Three steps: code, group, confirm name. Ends on / with a fresh whoami and student context.
 * A code that arrived in the URL (/join?code=...) or waits in sessionStorage (sign-up, or the 4-digit workshop
 * number the child just typed) skips the typing. The stored code stays until the join goes through, so a
 * reload mid-flow starts again at the group step. Renders inside a Suspense boundary (useSearchParams).
 */
export function JoinFlow() {
  const router = useRouter();
  const params = useSearchParams();
  const { ctx } = useStudentContext();
  const [prefill, setPrefill] = useState<string | null>(null);
  const [lastCode, setLastCode] = useState('');
  const [found, setFound] = useState<Found | null>(null);
  const [group, setGroup] = useState<FoundGroup | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const code = codeFromSearch(params) ?? peekPendingCode(sessionStorageOrNull());
    if (code) setPrefill(code);
  }, [params]);

  const onFound = useCallback((code: string, workshop: FoundWorkshop) => {
    setPrefill(null);
    setFound({ code, workshop });
  }, []);

  const backToCode = () => {
    if (found) setLastCode(found.code);
    clearPendingCode(sessionStorageOrNull()); // the student wants another code, so a reload must not bring this one back
    setPrefill(null);
    setFound(null);
  };

  const join = async (fullName: string) => {
    if (!found || !group) return;
    setBusy(true);
    setError('');
    try {
      await joinGroup(found.code, group.id, fullName);
      clearPendingCode(sessionStorageOrNull());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'משהו השתבש. נסו שוב בעוד רגע');
      setBusy(false);
      return;
    }
    try {
      await refreshAfterJoin();
      router.replace('/');
    } catch {
      // joined, but the refresh failed: a full navigation reloads everything from scratch
      window.location.assign('/');
    }
  };

  return (
    <div className={k.stack}>
      {ctx ? (
        <p className={j.notice}>
          אתם כבר בסדנה ״{ctx.workshop.title}״. <Link href="/">חזרה לבית</Link>
        </p>
      ) : null}
      {!found ? (
        <CodeStep key={prefill ?? lastCode} initialCode={prefill ?? lastCode} autoLookup={prefill !== null} onFound={onFound} />
      ) : !group ? (
        <>
          <CodeChip code={found.code} onChange={backToCode} />
          <GroupStep workshop={found.workshop} onPick={setGroup} onBack={backToCode} />
        </>
      ) : (
        <NameStep group={group} child={isWorkshopNumber(found.code)} busy={busy} error={error} onConfirm={(n) => void join(n)}
          onBack={() => { setGroup(null); setError(''); }} />
      )}
    </div>
  );
}
