'use client';
import Link from 'next/link';
import { useEffect, useState, type ReactNode } from 'react';
import { Spinner } from '@/components/ui/Spinner';
import { getUserId } from '@/lib/cv/session';
import { useStudentContext, type StudentContext } from '@/lib/student/context';
import s from './cv.module.css';

export interface CvSession {
  ctx: StudentContext;
  /** the key on every sc_detections / sc_training_jobs / sc_models row of this group */
  team: string;
  userId: string;
}

function Notice({ title, text, action }: { title: string; text: string; action: ReactNode }) {
  return (
    <div className={`${s.card} ${s.center} ${s.stack}`}>
      <h1 className={s.h2}>{title}</h1>
      <p className={s.lead}>{text}</p>
      {action}
    </div>
  );
}

/** Resolves the student context + Supabase user, and handles loading / no workshop / no group once for all four screens. */
export function CvGate({ children }: { children: (session: CvSession) => ReactNode }) {
  const { ctx, loaded, error, reload } = useStudentContext();
  const [userId, setUserId] = useState<string | null>(null);
  const [authError, setAuthError] = useState(false);

  useEffect(() => {
    getUserId().then(setUserId).catch(() => setAuthError(true));
  }, []);

  if (!loaded || (ctx && !userId && !authError)) return <div className={s.spin}><Spinner large /></div>;
  if (error && !ctx) {
    return (
      <Notice title="לא הצלחנו לטעון" text="בדקו את החיבור לאינטרנט ונסו שוב."
        action={<button type="button" className={`${s.btn} ${s.btnPrimary}`} onClick={() => void reload()}>ניסיון נוסף</button>} />
    );
  }
  if (!ctx) {
    return (
      <Notice title="עוד לא הצטרפתם לסדנה" text="כדי להתחיל צריך את הקוד מהמדריך."
        action={<Link href="/join" className={`${s.btn} ${s.btnPrimary}`}>הצטרפות עם קוד</Link>} />
    );
  }
  if (!ctx.group) {
    return (
      <Notice title="עוד לא הצטרפתם לקבוצה" text="התמונות והמודל שייכים לקבוצה, אז קודם בוחרים קבוצה."
        action={<Link href="/join" className={`${s.btn} ${s.btnPrimary}`}>בחירת קבוצה</Link>} />
    );
  }
  if (!userId) {
    return (
      <Notice title="צריך להתחבר מחדש" text="ההתחברות שלכם פגה. התחברו שוב כדי להמשיך."
        action={<Link href="/" className={`${s.btn} ${s.btnPrimary}`}>לדף הבית</Link>} />
    );
  }
  return <>{children({ ctx, team: ctx.group.team_name, userId })}</>;
}
