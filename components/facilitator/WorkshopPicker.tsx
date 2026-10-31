'use client';
// Step 0: which workshop are we teaching in front of? Without a session only the
// free card is offered (no database call at all); signed-in staff see their
// workshops through staff RLS. cycle_depth and band are new columns and may be null.
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { authStore, initAuth } from '@/lib/auth';
import { sb } from '@/lib/db';
import { CONSOLE_URL } from '@/lib/config';
import { useStore } from '@/lib/store';
import { Spinner } from '@/components/ui/Spinner';
import { AuthCard } from '@/components/student/shell/AuthCard';
import { FREE_WORKSHOP } from '@/lib/pocket/store';
import f from './facilitator.module.css';

interface WorkshopRow {
  id: string; title: string; code: string; status: string;
  cycle_depth: number | null; band: string | null; device_mode: string | null;
}

const STATUS_HE: Record<string, string> = { confirmed: 'מאושרת', live: 'פעילה' };

async function fetchWorkshops(): Promise<WorkshopRow[]> {
  const { data, error } = await sb.from('ws_workshops')
    .select('id,title,code,status,cycle_depth,band,device_mode')
    .in('status', ['confirmed', 'live'])
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as WorkshopRow[];
}

function FreeCard() {
  return (
    <Link href={`/facilitator/${FREE_WORKSHOP}`} className={`${f.card} ${f.cardFree}`}>
      <span className={f.cardTitle}>מצב חופשי</span>
      <span className={f.sub}>בלי סדנה. מלמדים, בודקים ומשחקים ברמזור. בלי התחברות.</span>
    </Link>
  );
}

function WorkshopCard({ w }: { w: WorkshopRow }) {
  return (
    <Link href={`/facilitator/${w.id}`} className={f.card}>
      <span className={f.cardTitle}>{w.title}</span>
      <span className={f.cardMeta}>
        <span className={f.tag} dir="ltr">{w.code}</span>
        <span className={f.tag}>{STATUS_HE[w.status] ?? w.status}</span>
        {w.band ? <span className={f.tag}>{w.band}</span> : null}
        {w.cycle_depth !== null && w.cycle_depth !== undefined ? <span className={f.tag}>רמה {w.cycle_depth}</span> : null}
      </span>
    </Link>
  );
}

/** Signed-in: the staff workshops (RLS decides what the account may see) plus the free card. */
function WorkshopList() {
  const [rows, setRows] = useState<WorkshopRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetchWorkshops()
      .then((r) => { if (alive) setRows(r); })
      .catch(() => { if (alive) { setRows([]); setError('לא הצלחנו לטעון את רשימת הסדנאות. אפשר להמשיך במצב חופשי.'); } });
    return () => { alive = false; };
  }, []);

  if (rows === null) return <Spinner large />;
  return (
    <>
      {error ? <p className={f.err} role="alert">{error}</p> : null}
      {!error && rows.length === 0 ? <p className={f.sub}>אין סדנאות פתוחות לחשבון הזה. אפשר להמשיך במצב חופשי.</p> : null}
      <div className={f.list}>
        {rows.map((w) => <WorkshopCard key={w.id} w={w} />)}
        <FreeCard />
      </div>
    </>
  );
}

export function WorkshopPicker() {
  const { user, loaded } = useStore(authStore);
  const [login, setLogin] = useState(false);

  useEffect(() => { void initAuth(); }, []);

  if (!loaded) return <main className="center-screen"><Spinner large /></main>;
  if (!user && login) return <AuthCard variant="staff" />;

  return (
    <div className={f.shell}>
      <header className={f.header}>
        <div className={f.titleRow}>
          <span className={f.title}>מצב מדריך</span>
          <a className={f.back} href={CONSOLE_URL}>לקונסולה</a>
        </div>
        <div style={{ height: 14 }} />
      </header>
      <main className={f.main}>
        <p className={f.lead}>{user ? 'באיזו סדנה אנחנו?' : 'מלמדים מחשב לראות, כאן ועכשיו'}</p>
        <p className={f.sub}>המודל שמלמדים כאן נשמר על המכשיר הזה לפי הסדנה, כך שאפשר להמשיך בשיעור הבא.</p>
        {user ? <WorkshopList /> : (
          <>
            <div className={f.list}><FreeCard /></div>
            <div className={f.actions}>
              <button type="button" onClick={() => setLogin(true)}>כניסת צוות</button>
              <span className={f.sub}>לסדנה רשומה, עם המפגש והגלריה של הקבוצות</span>
            </div>
          </>
        )}
      </main>
      <footer className={f.footer}>
        <span>הכול נשאר על המכשיר הזה. שום תמונה לא עולה.</span>
      </footer>
    </div>
  );
}
