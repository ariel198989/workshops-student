'use client';
import { readQuestions, moveAt, removeAt, replaceAt, type Exercise } from './module-form';
import {
  EXERCISE_KINDS, EXERCISE_KIND_LABELS, TOOL_HOOKS, TOOL_HOOK_LABELS,
} from './labels';
import styles from './editor.module.css';

interface Props { items: readonly Exercise[]; onChange: (items: Exercise[]) => void }

const NEW_EXERCISE: Exercise = { title: '', instructions: '', kind: 'group', tool_hook: 'none' };

/** Exercises: title, kind, tool hook, numbered instructions. Question banks are preserved untouched. */
export function ExercisesEditor({ items, onChange }: Props) {
  const patch = (i: number, p: Partial<Exercise>) => onChange(replaceAt(items, i, { ...items[i], ...p }));
  return (
    <div className={styles.group}>
      {items.map((ex, i) => {
        const questions = readQuestions(ex.questions).length;
        return (
          <div key={i} className={styles.exCard}>
            <div className={styles.exTop}>
              <input type="text" value={ex.title} placeholder="כותרת התרגיל" aria-label={`כותרת תרגיל ${i + 1}`}
                onChange={(e) => patch(i, { title: e.target.value })} />
              <select value={ex.kind} aria-label="סוג עבודה" onChange={(e) => patch(i, { kind: e.target.value })}>
                {EXERCISE_KINDS.map((k) => <option key={k} value={k}>{EXERCISE_KIND_LABELS[k]}</option>)}
              </select>
              <select value={ex.tool_hook} aria-label="כלי" onChange={(e) => patch(i, { tool_hook: e.target.value })}>
                {TOOL_HOOKS.map((h) => <option key={h} value={h}>{TOOL_HOOK_LABELS[h]}</option>)}
              </select>
              <span className={styles.rowTools}>
                <button type="button" className="ghost sm" disabled={i === 0} aria-label="העלאה"
                  onClick={() => onChange(moveAt(items, i, i - 1))}>▲</button>
                <button type="button" className="ghost sm" disabled={i === items.length - 1} aria-label="הורדה"
                  onClick={() => onChange(moveAt(items, i, i + 1))}>▼</button>
                <button type="button" className="ghost sm" onClick={() => onChange(removeAt(items, i))}>הסרה</button>
              </span>
            </div>
            <textarea className={styles.textarea} value={ex.instructions}
              placeholder={'1. שלב ראשון\n2. שלב שני'} aria-label={`הוראות תרגיל ${i + 1}`}
              onChange={(e) => patch(i, { instructions: e.target.value })} />
            {questions > 0 ? <div className={styles.exNote}>בנק של {questions} שאלות נשמר עם התרגיל.</div> : null}
          </div>
        );
      })}
      <div><button type="button" className="sm" onClick={() => onChange([...items, NEW_EXERCISE])}>הוסיפו תרגיל</button></div>
    </div>
  );
}
