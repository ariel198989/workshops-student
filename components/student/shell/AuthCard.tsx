'use client';
import { useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useState } from 'react';
import { CONSOLE_URL } from '@/lib/config';
import { STUDENT_ENTRY_LINKS, type StudentEntryLink } from '@/lib/student/entry';
import { isWorkshopNumber } from '@/lib/student/number-login';
import { peekPendingCode, sessionStorageOrNull, storePendingCode, takeEntryHint } from '@/lib/student/pending';
import { GroupLogin } from './GroupLogin';
import { NumberEntry } from './NumberEntry';
import { StudentLogin } from './StudentLogin';
import { StudentSignup } from './StudentSignup';
import k from './kit.module.css';
import a from './auth.module.css';
import ne from './number-entry.module.css';

type Tab = 'signup' | 'login';
export type AuthVariant = 'student' | 'staff';

interface Props {
  /** student: the workshop number first, QR / code + PIN / email as quiet links. staff: login only, titled כניסת צוות, with a link to the console. */
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

interface LinksProps {
  qrOpen: boolean;
  emailOpen: boolean;
  onPick: (link: StudentEntryLink) => void;
}

/** The other doors, in STUDENT_ENTRY_LINKS order. The QR item only unfolds a sentence: the camera app does the work. */
function EntryLinks({ qrOpen, emailOpen, onPick }: LinksProps) {
  const qr = STUDENT_ENTRY_LINKS.find((l) => l.id === 'qr');
  return (
    <>
      <nav className={ne.links} aria-label="דרכים אחרות להיכנס">
        {STUDENT_ENTRY_LINKS.map((link, i) => (
          <span key={link.id} className={ne.linkItem}>
            {i > 0 ? <span className={ne.dotSep} aria-hidden="true">·</span> : null}
            <button type="button" className={ne.link} onClick={() => onPick(link)}
              aria-expanded={link.id === 'qr' ? qrOpen : link.id === 'email' ? emailOpen : undefined}>
              {link.label}
            </button>
          </span>
        ))}
      </nav>
      {qrOpen && qr?.explainer ? <p className={ne.explainer}>{qr.explainer}</p> : null}
    </>
  );
}

/** Signed-out screen. Rendered as the page's <main> because nothing else is on screen with it. */
export function AuthCard({ variant = 'student' }: Props) {
  const staff = variant === 'staff';
  const [tab, setTab] = useState<Tab>(staff ? 'login' : 'signup');
  const [groupEntry, setGroupEntry] = useState(false);
  const [emailOpen, setEmailOpen] = useState(staff);
  const [qrOpen, setQrOpen] = useState(false);
  const [pendingCode, setPendingCode] = useState<string | null>(null);

  // a saved workshop number belongs to the keypad flow; only a real code (OFEK-H2-27) opens the email account
  const onPendingCode = useCallback((code: string) => {
    if (isWorkshopNumber(code)) return;
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

  const pick = (link: StudentEntryLink) => {
    if (link.id === 'qr') setQrOpen((v) => !v);
    else if (link.id === 'pin') setGroupEntry(true);
    else setEmailOpen((v) => !v);
  };

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
        <NumberEntry />
        <EntryLinks qrOpen={qrOpen} emailOpen={emailOpen} onPick={pick} />
        {emailOpen ? (
          <div className={a.emailBlock}>
            {pendingCode ? (
              <p className={a.codeNote}>
                הקוד <b dir="ltr">{pendingCode}</b> שמור. אחרי הכניסה תצטרפו ישר לקבוצה.
              </p>
            ) : null}
            <EmailAuth staff={false} tab={tab} onTab={setTab} />
          </div>
        ) : null}
      </div>
    </main>
  );
}
