'use client';
import { useEffect, useState } from 'react';
import { verifyCertificate } from '@/lib/ws/certificates';
import { formatDateHe } from '@/lib/ws/certificate-templates';
import type { VerifyResult as VerifyData } from '@/lib/ws/types';
import styles from './verify.module.css';

type State =
  | { kind: 'loading' }
  | { kind: 'error' }
  | { kind: 'found'; data: VerifyData | null };

const CODE_SHAPE = /^[0-9a-f]{32}$/;

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" strokeWidth="2.6"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
  );
}
function CrossIcon() {
  return (
    <svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" strokeWidth="2.6"
      strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
  );
}

function Row({ label, value, ltr = false }: { label: string; value: string | null; ltr?: boolean }) {
  if (!value) return null;
  return (
    <div className={styles.row}>
      <dt>{label}</dt>
      <dd dir={ltr ? 'ltr' : undefined}>{value}</dd>
    </div>
  );
}

function Body({ state }: { state: State }) {
  if (state.kind === 'loading') {
    return <p className={styles.note} role="status">בודקים את התעודה...</p>;
  }
  if (state.kind === 'error') {
    return (
      <>
        <span className={`${styles.badge} ${styles.warn}`}><CrossIcon /></span>
        <h1>האימות לא זמין כרגע</h1>
        <p className={styles.note}>אירעה שגיאה בבדיקה. נסו שוב בעוד רגע.</p>
      </>
    );
  }
  const { data } = state;
  if (!data) {
    return (
      <>
        <span className={`${styles.badge} ${styles.bad}`}><CrossIcon /></span>
        <h1>התעודה לא נמצאה</h1>
        <p className={styles.note}>הקוד לא תואם לאף תעודה. בדקו את הקישור או את הקוד המודפס על התעודה.</p>
      </>
    );
  }
  return (
    <>
      <span className={`${styles.badge} ${data.valid ? styles.good : styles.bad}`}>
        {data.valid ? <CheckIcon /> : <CrossIcon />}
      </span>
      <h1>{data.valid ? 'התעודה תקפה' : 'התעודה בוטלה'}</h1>
      {data.valid ? null : <p className={styles.note}>תעודה זו בוטלה ואינה תקפה.</p>}
      <dl className={styles.details}>
        <Row label="מספר תעודה" value={data.certificate_no} ltr />
        <Row label="נמען" value={data.recipient} />
        <Row label="סדנה" value={data.workshop} />
        <Row label="ארגון" value={data.organization} />
        <Row label="תאריך הנפקה" value={formatDateHe(data.issued_at)} />
      </dl>
    </>
  );
}

/** Public certificate check. The RPC is anon-callable and returns first name + initial only. */
export function VerifyResult({ code }: { code: string }) {
  const [state, setState] = useState<State>({ kind: 'loading' });

  useEffect(() => {
    let alive = true;
    if (!CODE_SHAPE.test(code)) {
      setState({ kind: 'found', data: null });
      return;
    }
    verifyCertificate(code)
      .then((data) => { if (alive) setState({ kind: 'found', data }); })
      .catch(() => { if (alive) setState({ kind: 'error' }); });
    return () => { alive = false; };
  }, [code]);

  return (
    <main className={styles.screen}>
      <section className={styles.card} aria-live="polite">
        <span className={styles.brand}>Corewise</span>
        <Body state={state} />
      </section>
      <p className={styles.foot}>אימות תעודות סדנאות ראייה ממוחשבת</p>
    </main>
  );
}
