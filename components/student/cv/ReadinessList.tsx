'use client';
import Link from 'next/link';
import { RED_BELOW, STRONG_FROM, type CoverageRow, type Tier } from '@/lib/cv/readiness';
import s from './cv.module.css';

const BAR_MAX = 200;
const FILL: Record<Tier, string> = { red: s.tierRed, ok: s.tierOk, strong: s.tierStrong };
const TEXT: Record<Tier, string> = { red: s.tierTextRed, ok: s.tierTextOk, strong: s.tierTextStrong };

function tierNote(row: CoverageRow): string {
  if (row.tier === 'red') return `חסרות עוד ${row.missing} תמונות ליעד הראשון`;
  if (row.tier === 'ok') return `בדרך. עוד ${STRONG_FROM - row.count} לדאטה חזק`;
  return 'מצוין';
}

/** Per object: tagged photos against the 50 (usable) and 150 (strong) goals. */
export function ReadinessList({ rows }: { rows: CoverageRow[] }) {
  return (
    <div>
      {rows.map((row) => (
        <div key={row.name} className={s.row}>
          <div className={s.rowHead}>
            <b>{row.name}{row.offTarget ? ' (מחוץ ליעדים)' : ''}</b>
            <span className={s.num}>{row.count} מתוך {RED_BELOW} / {STRONG_FROM}</span>
          </div>
          <div className={s.track} role="progressbar" aria-valuemin={0} aria-valuemax={BAR_MAX} aria-valuenow={Math.min(row.count, BAR_MAX)}
            aria-label={`${row.name}: ${row.count} תמונות מתויגות`}>
            <div className={`${s.fill} ${FILL[row.tier]}`} style={{ inlineSize: `${Math.min(100, (row.count / BAR_MAX) * 100)}%` }} />
            <span className={s.mark} style={{ insetInlineStart: `${(RED_BELOW / BAR_MAX) * 100}%` }} />
            <span className={s.mark} style={{ insetInlineStart: `${(STRONG_FROM / BAR_MAX) * 100}%` }} />
          </div>
          <div className={s.rowFoot}>
            <span className={`${s.tierText} ${TEXT[row.tier]}`}>{tierNote(row)}</span>
            {row.tier !== 'strong' && !row.offTarget ? (
              <Link href={`/student/capture?cls=${encodeURIComponent(row.name)}`} className={s.link}>צלמו עוד</Link>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}
