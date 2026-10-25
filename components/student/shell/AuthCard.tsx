'use client';
import { useState } from 'react';
import { StudentLogin } from './StudentLogin';
import { StudentSignup } from './StudentSignup';
import k from './kit.module.css';
import a from './auth.module.css';

type Tab = 'signup' | 'login';

/** Signed-out screen: new students sign up (default tab), returning students log in on the second. */
export function AuthCard() {
  const [tab, setTab] = useState<Tab>('signup');
  const tabClass = (t: Tab) => (tab === t ? `${k.tab} ${k.tabOn}` : k.tab);
  return (
    <div className={a.screen}>
      <div className={a.card}>
        <h1 className={a.brand}>Workshops</h1>
        <p className={a.by}>by Corewise</p>
        <p className={`${k.lead} ${k.center} ${a.intro}`}>
          {tab === 'login' ? 'ברוכים השבים' : 'פותחים חשבון ומצטרפים לסדנה'}
        </p>
        <div className={k.tabs} role="tablist" aria-label="כניסה או הרשמה">
          <button type="button" role="tab" aria-selected={tab === 'signup'} className={tabClass('signup')}
            onClick={() => setTab('signup')}>הרשמה</button>
          <button type="button" role="tab" aria-selected={tab === 'login'} className={tabClass('login')}
            onClick={() => setTab('login')}>כניסה</button>
        </div>
        {tab === 'signup' ? <StudentSignup /> : <StudentLogin />}
      </div>
    </div>
  );
}
