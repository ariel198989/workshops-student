'use client';
import { useState } from 'react';
import { DEMO_DAY_RUBRIC } from '@/lib/ws/deliverables';
import { toast } from '@/lib/store';
import { isComplete, levelText, rubricTotal, scoreBand, type RubricScores } from './rubric';
import { LEVEL_LABELS } from './rubric-levels';
import styles from './p5.module.css';

interface RubricFormProps {
  initial: RubricScores;
  disabled: boolean;
  /** receives the scores and the weighted total (0..100); throws on failure */
  onSave: (scores: RubricScores, total: number) => Promise<void>;
}

const LEVELS = Array.from({ length: DEMO_DAY_RUBRIC.maxLevel }, (_, i) => i + 1);

/** Demo Day rubric: 6 criteria, 4 levels each, weights add up to 100. */
export function RubricForm({ initial, disabled, onSave }: RubricFormProps) {
  const [scores, setScores] = useState<RubricScores>(initial);
  const [busy, setBusy] = useState(false);
  const total = rubricTotal(scores);
  const complete = isComplete(scores);

  const save = async () => {
    setBusy(true);
    try {
      await onSave(scores, total);
    } catch (err) {
      toast(err instanceof Error ? err.message : 'השמירה נכשלה');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="stack">
      {DEMO_DAY_RUBRIC.criteria.map((c) => {
        const level = scores[c.id];
        return (
          <fieldset key={c.id} className={styles.criterion} disabled={disabled}>
            <legend>
              {c.title} <span className="hint">משקל {c.weight}</span>
            </legend>
            <div className={styles.levels} role="radiogroup" aria-label={c.title}>
              {LEVELS.map((l) => (
                <button key={l} type="button" role="radio" aria-checked={level === l}
                  className={level === l ? `${styles.level} ${styles.levelOn}` : styles.level}
                  onClick={() => setScores({ ...scores, [c.id]: l })}>
                  {l} {LEVEL_LABELS[l]}
                </button>
              ))}
            </div>
            {level ? <p className="hint">{levelText(c.id, level)}</p> : null}
          </fieldset>
        );
      })}
      <div className={styles.rubricFoot}>
        <span className={styles.total}>
          <span className="num">{total}</span> / 100
        </span>
        <span className="hint">{complete ? scoreBand(total) : 'דרגו את כל הקריטריונים כדי לשמור'}</span>
        {disabled ? null : (
          <button type="button" className="primary" disabled={!complete || busy} onClick={() => void save()}>
            שמירת ציון
          </button>
        )}
      </div>
    </div>
  );
}
