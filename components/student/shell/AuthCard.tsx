'use client';
import { useState } from 'react';
import { CONSOLE_URL } from '@/lib/config';
import { GroupLogin } from './GroupLogin';
import { StudentLogin } from './StudentLogin';
import { StudentSignup } from './StudentSignup';
import k from './kit.module.css';
import a from './auth.module.css';
import gl from './group-login.module.css';

type Tab = 'signup' | 'login';
export type AuthVariant = 'student' | 'staff';

interface Props {
  /** student: sign up first, login second, plus the group tablet entry. staff: login only, titled כניסת צוות, with a link to the console. */
  variant?: AuthVariant;
}

/** Signed-out screen. Rendered as the page's <main> because nothing else is on screen with it. */
export function AuthCard({ variant = 'student' }: Props) {
  const staff = variant === 'staff';
  const [tab, setTab] = useState<Tab>(staff ? 'login' : 'signup');
  const [groupEntry, setGroupEntry] = useState(false);
  const tabClass = (t: Tab) => (tab === t ? `${k.tab} ${k.tabOn}` : k.tab);

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

  return (
    <main className={a.screen}>
      <div className={a.card}>
        <h1 className={a.brand}>{staff ? 'כניסת צוות' : 'Workshops'}</h1>
        <p className={a.by}>{staff ? 'Workshops by Corewise' : 'by Corewise'}</p>
        <p className={`${k.lead} ${k.center} ${a.intro}`}>
          {staff ? 'נכנסים עם חשבון הצוות של הקונסולה' : tab === 'login' ? 'ברוכים השבים' : 'פותחים חשבון ומצטרפים לסדנה'}
        </p>
        {staff ? null : (
          <div className={k.tabs} role="tablist" aria-label="כניסה או הרשמה">
            <button type="button" role="tab" aria-selected={tab === 'signup'} className={tabClass('signup')}
              onClick={() => setTab('signup')}>הרשמה</button>
            <button type="button" role="tab" aria-selected={tab === 'login'} className={tabClass('login')}
              onClick={() => setTab('login')}>כניסה</button>
          </div>
        )}
        {tab === 'signup' ? <StudentSignup /> : <StudentLogin />}
        {staff ? (
          <p className={a.foot}>
            אין לכם חשבון צוות? <a href={CONSOLE_URL}>לקונסולת הצוות</a>
          </p>
        ) : (
          <button type="button" className={gl.entry} onClick={() => setGroupEntry(true)}>
            כניסה עם קוד ו-PIN
            <small>לטאבלט של הקבוצה, בלי אימייל</small>
          </button>
        )}
      </div>
    </main>
  );
}
