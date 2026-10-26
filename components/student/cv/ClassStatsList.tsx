'use client';
import Link from 'next/link';
import type { MetricClassLine, MetricViewModel } from '@/lib/student/metric';
import s from './cv.module.css';

function Row({ line, canCapture }: { line: MetricClassLine; canCapture: boolean }) {
  const body = (
    <>
      <span className={s.statName}>{line.name}</span>
      <span className={s.statPct}>{line.text}</span>
      {line.fill !== null ? (
        <span className={s.statBar} aria-hidden><i style={{ inlineSize: `${Math.max(4, Math.round(line.fill * 100))}%` }} /></span>
      ) : null}
      {line.detail ? <span className={s.statDetail}>{line.detail}</span> : null}
      {line.weak ? (
        <span className={s.statFix}>{canCapture ? 'צלמו עוד תמונות של האובייקט הזה' : 'המודל עוד לא מזהה אותו טוב'}</span>
      ) : null}
    </>
  );
  if (line.weak && canCapture) {
    return <Link href={`/capture?cls=${encodeURIComponent(line.name)}`} className={`${s.statRow} ${s.statRowWeak}`}>{body}</Link>;
  }
  return <div className={line.weak ? `${s.statRow} ${s.statRowWeak}` : s.statRow}>{body}</div>;
}

/** Per-object result in the band's language. Weak objects are highlighted and link straight to capturing them. */
export function ClassStatsList({ view, canCapture }: { view: MetricViewModel; canCapture: boolean }) {
  return (
    <div className={s.card}>
      <div className={s.cardHead}>מה המודל למד, לפי אובייקט</div>
      {view.classes.length === 0 ? (
        <p className={s.small}>המודל הזה לא שמר פירוט לפי אובייקט. אחרי האימון הבא הוא יופיע כאן.</p>
      ) : (
        <div className={s.stack}>
          {view.classes.map((line) => <Row key={line.name} line={line} canCapture={canCapture} />)}
          <p className={s.small}>{view.weakNote}</p>
        </div>
      )}
    </div>
  );
}
