import { HugeiconsIcon } from '@hugeicons/react';
import { ChartLineData01Icon } from '@hugeicons/core-free-icons';
import type { MyStats, StudentProgress } from '@/lib/student/context';
import { MIN_TAGGED, STRONG_TAGGED, barFill, classLevel, type ClassLevel } from '@/lib/student/next-step';
import { untaggedOf } from '@/lib/student/scope';
import k from './kit.module.css';
import h from './home.module.css';

const LEVEL_TEXT: Record<ClassLevel, string> = { red: 'עוד צריך', ok: 'מספיק לאימון', strong: 'מצוין' };
const FILL: Record<ClassLevel, string> = { red: h.red, ok: h.okc, strong: h.strong };
const LEVEL_CLASS: Record<ClassLevel, string> = { red: h.levelred, ok: h.levelok, strong: h.levelstrong };
const MIN_POS = (MIN_TAGGED / STRONG_TAGGED) * 100;

function ClassBar({ name, tagged }: { name: string; tagged: number }) {
  const level = classLevel(tagged);
  return (
    <div>
      <div className={h.barHead}>
        <b>{name}</b>
        <span><span className={h.barCount}>{tagged}</span>{' '}<span className={`${h.level} ${LEVEL_CLASS[level]}`}>{LEVEL_TEXT[level]}</span></span>
      </div>
      <div className={h.track} role="progressbar" aria-label={`תמונות מתויגות: ${name}`}
        aria-valuemin={0} aria-valuemax={STRONG_TAGGED} aria-valuenow={Math.min(tagged, STRONG_TAGGED)}>
        <div className={`${h.fill} ${FILL[level]}`} style={{ inlineSize: `${barFill(tagged)}%` }} />
        <span className={h.mark} style={{ insetInlineStart: `${MIN_POS}%` }} />
      </div>
      <div className={h.ticks} aria-hidden="true">
        <span className={h.tick} style={{ insetInlineStart: `${MIN_POS}%` }}>{MIN_TAGGED}</span>
        <span className={`${h.tick} ${h.tickEnd}`}>{STRONG_TAGGED}</span>
      </div>
    </div>
  );
}

/** Personal pool scope: my photos, my tags, my model, and one bar of my tagged total against the 50 / 150 marks. */
function MyProgress({ mine }: { mine: MyStats }) {
  return (
    <section className={k.card}>
      <div className={k.cardHead}><HugeiconsIcon icon={ChartLineData01Icon} size={18} />ההתקדמות שלי</div>
      <div className={h.stats}>
        <div className={h.stat}><b>{mine.photos}</b><span>התמונות שלי</span></div>
        <div className={h.stat}><b>{mine.tagged}</b><span>תייגתי</span></div>
        <div className={h.stat}><b>{mine.models > 0 ? 'מוכן' : 'עוד לא'}</b><span>המודל שלי</span></div>
      </div>
      <div className={h.bars}>
        <ClassBar name="התמונות המתויגות שלי" tagged={mine.tagged} />
      </div>
      {untaggedOf(mine) > 0 ? <p className={k.small}>עוד {untaggedOf(mine)} תמונות שלי מחכות לתיוג.</p> : null}
    </section>
  );
}

interface Props {
  progress: StudentProgress | null;
  /** set in personal pool scope: the card then shows my own counts instead of the group's */
  mine?: MyStats | null;
}

/** Photos / tagged / untagged plus one bar per target class, with marks at 50 (enough to train) and 150 (strong). */
export function ProgressCard({ progress, mine = null }: Props) {
  if (mine) return <MyProgress mine={mine} />;
  const p = progress;
  return (
    <section className={k.card}>
      <div className={k.cardHead}><HugeiconsIcon icon={ChartLineData01Icon} size={18} />ההתקדמות של הקבוצה</div>
      <div className={h.stats}>
        <div className={h.stat}><b>{p?.photos ?? 0}</b><span>צולמו</span></div>
        <div className={h.stat}><b>{p?.tagged ?? 0}</b><span>תויגו</span></div>
        <div className={h.stat}><b>{p?.untagged ?? 0}</b><span>מחכות לתיוג</span></div>
      </div>
      {p && p.coverage.length > 0 ? (
        <div className={h.bars}>
          {p.coverage.map((c) => <ClassBar key={c.name} name={c.name} tagged={c.tagged} />)}
        </div>
      ) : (
        <p className={k.small}>כשהמדריך יגדיר מה מחפשים, יופיע כאן פס התקדמות לכל אחד.</p>
      )}
    </section>
  );
}
