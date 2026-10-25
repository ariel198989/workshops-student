import type { ClassCoverage, Readiness } from '@/lib/ws/types';
import { BAR_MAX, TICK_PERCENTS, barPercent, readinessTier } from './readiness';
import styles from './board.module.css';

interface ReadinessBarProps {
  coverage: readonly ClassCoverage[];
  readiness: Readiness;
}

/** One bar per target class (tagged photos). Red under 50, amber 50-149, green 150+, ticks at 50 and 150. */
export function ReadinessBar({ coverage, readiness }: ReadinessBarProps) {
  if (readiness === 'no_targets' || coverage.length === 0) {
    return <p className={styles.noTargets}>עדיין לא הוגדרו מחלקות יעד.</p>;
  }
  return (
    <ul className={styles.bars} aria-label="כיסוי לפי מחלקה">
      {coverage.map((c) => {
        const tier = readinessTier(c.tagged);
        return (
          <li key={c.name}>
            <div className={styles.barHead}>
              <span className={styles.cls}>{c.name}</span>
              <span className={`${styles.cnt} ${styles[`c_${tier}`]}`}>{c.tagged}</span>
            </div>
            <div className={styles.track} role="progressbar" aria-valuemin={0} aria-valuemax={BAR_MAX}
              aria-valuenow={Math.min(c.tagged, BAR_MAX)} aria-label={`${c.name}: ${c.tagged} מתויגות`}>
              <span className={`${styles.fill} ${styles[`t_${tier}`]}`} style={{ width: `${barPercent(c.tagged)}%` }} />
              {TICK_PERCENTS.map((t) => <span key={t} className={styles.tick} style={{ insetInlineStart: `${t}%` }} />)}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
