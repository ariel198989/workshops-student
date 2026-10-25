'use client';
import { useState } from 'react';
import { StudentLogin } from './StudentLogin';
import { StudentSignup } from './StudentSignup';
import k from './kit.module.css';
import a from './auth.module.css';

type Tab = 'login' | 'signup';

/** Signed-out screen: staff and student sign in on one tab, new students sign up on the other. */
export function AuthCard() {
  const [tab, setTab] = useState<Tab>('login');
  const tabClass = (t: Tab) => (tab === t ? `${k.tab} ${k.tabOn}` : k.tab);
  return (
    <div className={a.screen}>
      <div className={a.card}>
        <h1 className={a.brand}>Workshops OS</h1>
        <p className={a.by}>by Corewise</p>
        <p className={`${k.lead} ${k.center} ${a.intro}`}>
          {tab === 'login' ? 'ברוכים השבים' : 'פותחים חשבון ומצטרפים לסדנה'}
        </p>
        <div className={k.tabs} role="tablist" aria-label="כניסה או הרשמה">
          <button type="button" role="tab" aria-selected={tab === 'login'} className={tabClass('login')}
            onClick={() => setTab('login')}>כניסת צוות / תלמיד</button>
          <button type="button" role="tab" aria-selected={tab === 'signup'} className={tabClass('signup')}
            onClick={() => setTab('signup')}>הרשמת תלמיד</button>
        </div>
        {tab === 'login' ? <StudentLogin /> : <StudentSignup />}
      </div>
    </div>
  );
}
