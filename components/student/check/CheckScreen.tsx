'use client';
import Link from 'next/link';
import { useState } from 'react';
import { Spinner } from '@/components/ui/Spinner';
import type { ConceptCheck } from '@/lib/student/concept';
import { useStudentContext } from '@/lib/student/context';
import k from '@/components/student/shell/kit.module.css';
import { CheckForm } from './CheckForm';
import { CheckList } from './CheckList';

/** /check: the workshop's concept checks. The route guard already sent students of check-less workshops home. */
export function CheckScreen() {
  const { ctx, loaded, error, reload } = useStudentContext();
  const [open, setOpen] = useState<ConceptCheck | null>(null);

  if (!loaded) return <div className={k.spin}><Spinner large /></div>;
  if (!ctx) {
    return (
      <div className={`${k.card} ${k.center} ${k.stack}`}>
        <h1 className={k.h2}>{error ? 'לא הצלחנו לטעון' : 'עוד לא הצטרפתם לסדנה'}</h1>
        <p className={k.lead}>{error ? 'בדקו את החיבור לאינטרנט ונסו שוב.' : 'כדי להתחיל צריך את הקוד מהמדריך.'}</p>
        {error
          ? <button type="button" className={`${k.btn} ${k.btnPrimary}`} onClick={() => void reload()}>ניסיון נוסף</button>
          : <Link href="/join" className={`${k.btn} ${k.btnPrimary}`}>הצטרפות עם קוד</Link>}
      </div>
    );
  }
  if (open) return <CheckForm key={open.session_module_id} check={open} onBack={() => setOpen(null)} />;
  return <CheckList checks={ctx.checks} onOpen={setOpen} />;
}
