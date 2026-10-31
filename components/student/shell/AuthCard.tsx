'use client';
import { useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useState } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import { QrCodeIcon } from '@hugeicons/core-free-icons';
import { CONSOLE_URL } from '@/lib/config';
import { peekPendingCode, sessionStorageOrNull, storePendingCode, takeEntryHint } from '@/lib/student/pending';
import { GroupLogin } from './GroupLogin';
import { StudentLogin } from './StudentLogin';
import { StudentSignup } from './StudentSignup';
import k from './kit.module.css';
import a from './auth.module.css';
import gl from './group-login.module.css';

type Tab = 'signup' | 'login';
export type AuthVariant = 'student' | 'staff';

interface Props {
  /** student: scan first, code + PIN second, email account folded away. staff: login only, titled כניסת צוות, with a link to the console. */
  variant?: AuthVariant;
}

/** /join?code=XXXX opened signed out: keep the code for after sign-up. Needs Suspense (useSearchParams). */
function PendingCodeCapture({ onCode }: { onCode: (code: string) => void }) {
  const params = useSearchParams();
  useEffect(() => {
    const code = storePendingCode(sessionStorageOrNull(), params.get('code'));
    if (code) onCode(code);
  }, [params, onCode]);
  return null;
}

/** The sign-up / login tabs and their forms. */
function EmailAuth({ staff, tab, onTab }: { staff: boolean; tab: Tab; onTab: (t: Tab) => void }) {
  const tabClass = (t: Tab) => (tab === t ? `${k.tab} ${k.tabOn}` : k.tab);
  return (
    <>
      <p className={`${k.lead} ${k.center} ${a.intro}`}>
        {staff ? 'נכנסים עם חשבון הצוות של הקונסולה' : tab === 'login' ? 'ברוכים השבים' : 'פותחים חשבון ומצטרפים לסדנה'}
      </p>
      {staff ? null : (
        <div className={k.tabs} role="tablist" aria-label="כניסה או הרשמה">
          <button type="button" role="tab" aria-selected={tab === 'signup'} className={tabClass('signup')}
            onClick={() => onTab('signup')}>הרשמה</button>
          <button type="button" role="tab" aria-selected={tab === 'login'} className={tabClass('login')}
            onClick={() => onTab('login')}>כניסה</button>
        </div>
      )}
      {tab === 'signup' ? <StudentSignup /> : <StudentLogin />}
    </>
  );
}

/** Signed-out screen. Rendered as the page's <main> because nothing else is on screen with it. */
export function AuthCard({ variant = 'student' }: Props) {
  const staff = variant === 'staff';
  const [tab, setTab] = useState<Tab>(staff ? 'login' : 'signup');
  const [groupEntry, setGroupEntry] = useState(false);
  const [emailOpen, setEmailOpen] = useState(staff);
  const [pendingCode, setPendingCode] = useState<string | null>(null);

  const onPendingCode = useCallback((code: string) => {
    setPendingCode(code);
    setEmailOpen(true);
  }, []);

  useEffect(() => {
    if (staff) return;
    const storage = sessionStorageOrNull();
    if (takeEntryHint(storage) === 'pin') setGroupEntry(true);
    const code = peekPendingCode(storage);
    if (code) onPendingCode(code);
  }, [staff, onPendingCode]);

  if (groupEntry && !staff) {
    return (
      <main className={a.screen}>
        <div className={a.card}>
          <h1 className={a.brand}>Workshops</h1>
          <p className={a.by}>by Corewise</p>
          <GroupLogin onBack={() => setGroupEntry(false)} />
        </div>
      </main>
    );
  }

  if (staff) {
    return (
      <main className={a.screen}>
        <div className={a.card}>
          <h1 className={a.brand}>כניסת צוות</h1>
          <p className={a.by}>Workshops by Corewise</p>
          <EmailAuth staff tab={tab} onTab={setTab} />
          <p className={a.foot}>
            אין לכם חשבון צוות? <a href={CONSOLE_URL}>לקונסולת הצוות</a>
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className={a.screen}>
      <Suspense fallback={null}><PendingCodeCapture onCode={onPendingCode} /></Suspense>
      <div className={a.card}>
        <h1 className={a.brand}>Workshops</h1>
        <p className={a.by}>by Corewise</p>
        {pendingCode ? (
          <p className={a.codeNote}>
            הקוד <b dir="ltr">{pendingCode}</b> שמור. אחרי הכניסה תצטרפו ישר לקבוצה.
          </p>
        ) : null}
        <section className={gl.scan} aria-labelledby="scan-title">
          <HugeiconsIcon icon={QrCodeIcon} size={40} />
          <h2 id="scan-title" className={gl.scanTitle}>יש לי קישור או QR מהמדריך? סרקו אותו</h2>
          <p className={gl.scanText}>הטלפון או הטאבלט נכנסים לקבוצה לבד, בלי להקליד כלום.</p>
        </section>
        <button type="button" className={gl.entry} onClick={() => setGroupEntry(true)}>
          כניסה עם קוד ו-PIN
          <small>לטאבלט של הקבוצה, בלי אימייל</small>
        </button>
        {emailOpen ? (
          <div className={a.emailBlock}>
            <EmailAuth staff={false} tab={tab} onTab={setTab} />
          </div>
        ) : (
          <button type="button" className={a.emailLink} aria-expanded={false} onClick={() => setEmailOpen(true)}>
            יש לי חשבון עם אימייל
          </button>
        )}
      </div>
    </main>
  );
}
