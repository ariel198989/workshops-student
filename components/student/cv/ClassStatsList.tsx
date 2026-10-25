'use client';
import Link from 'next/link';
import { isWeak, parseClassStats, type ClassStat } from '@/lib/cv/readiness';
import s from './cv.module.css';

function Row({ stat }: { stat: ClassStat }) {
  const pct = stat.ap50 != null ? Math.round(stat.ap50 * 100) : null;
  const weak = isWeak(stat);
  const body = (
    <>
      <span className={s.statName}>{stat.name}</span>
      <span className={s.statPct}>{pct !== null ? `${pct}%` : 'לא נמדד'}</span>
      <span className={s.statBar} aria-hidden><i style={{ inlineSize: `${pct ?? 4}%` }} /></span>
      {weak ? <span className={s.statFix}>צלמו עוד (יש {stat.boxes ?? '?'} תיבות באימון)</span> : null}
    </>
  );
  return weak
    ? <Link href={`/student/capture?cls=${encodeURIComponent(stat.name)}`} className={`${s.statRow} ${s.statRowWeak}`}>{body}</Link>
    : <div className={s.statRow}>{body}</div>;
}

/** Per-object score from the training run. Weak objects are highlighted and link straight to capturing them. */
export function ClassStatsList({ raw }: { raw: unknown }) {
  const stats = parseClassStats(raw);
  return (
    <div className={s.card}>
      <div className={s.cardHead}>מה המודל למד, לפי אובייקט</div>
      {stats.length === 0 ? (
        <p className={s.small}>המודל הזה לא שמר פירוט לפי אובייקט. אחרי האימון הבא הוא יופיע כאן.</p>
      ) : (
        <div className={s.stack}>
          {stats.map((st) => <Row key={st.name} stat={st} />)}
          <p className={s.small}>אובייקט מסומן כחלש כשהציון שלו מתחת ל-50% או כשהיו לו פחות מ-20 תיבות באימון.</p>
        </div>
      )}
    </div>
  );
}
