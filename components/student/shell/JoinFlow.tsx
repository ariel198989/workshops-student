'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useStudentContext } from '@/lib/student/context';
import { joinGroup, refreshAfterJoin, type FoundGroup, type FoundWorkshop } from '@/lib/student/join';
import { CodeStep } from './CodeStep';
import { GroupStep } from './GroupStep';
import { NameStep } from './NameStep';
import k from './kit.module.css';
import j from './join.module.css';

interface Found { code: string; workshop: FoundWorkshop }

/** Three steps: code, group, confirm name. Ends on / with a fresh whoami and student context. */
export function JoinFlow() {
  const router = useRouter();
  const { ctx } = useStudentContext();
  const [found, setFound] = useState<Found | null>(null);
  const [group, setGroup] = useState<FoundGroup | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const join = async (fullName: string) => {
    if (!found || !group) return;
    setBusy(true);
    setError('');
    try {
      await joinGroup(found.code, group.id, fullName);
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
        <CodeStep onFound={(code, workshop) => setFound({ code, workshop })} />
      ) : !group ? (
        <GroupStep workshop={found.workshop} onPick={setGroup} onBack={() => setFound(null)} />
      ) : (
        <NameStep group={group} busy={busy} error={error} onConfirm={(n) => void join(n)}
          onBack={() => { setGroup(null); setError(''); }} />
      )}
    </div>
  );
}
