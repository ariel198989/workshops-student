import { Pill } from '../StatusPill';
import { readQuestions, type Exercise } from './module-form';
import { kindLabel, toolHookLabel } from './labels';
import { instructionSteps } from './notes';
import styles from './guide.module.css';

const LETTERS = ['א', 'ב', 'ג', 'ד', 'ה', 'ו'];

function QuestionBank({ raw }: { raw: unknown }) {
  const questions = readQuestions(raw);
  if (questions.length === 0) return null;
  return (
    <div className={styles.questions}>
      <div className={styles.qTitle}>בנק שאלות ({questions.length}), התשובה הנכונה מסומנת</div>
      {questions.map((q, qi) => (
        <div key={qi} className={styles.question}>
          <div className={styles.qText}>{qi + 1}. {q.q}</div>
          <ul className={styles.options}>
            {q.options.map((opt, oi) => (
              <li key={oi} className={`${styles.option} ${oi === q.answer ? styles.correct : ''}`}>
                <span className={styles.optMark}>{oi === q.answer ? '✓' : LETTERS[oi] ?? oi + 1}</span>
                <span>{opt}</span>
                {oi === q.answer ? <span className={styles.srOnly}> (תשובה נכונה)</span> : null}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

export function ExerciseView({ exercise }: { exercise: Exercise }) {
  const steps = instructionSteps(exercise.instructions);
  const minutes = typeof exercise.duration_min === 'number' ? exercise.duration_min : null;
  return (
    <article className={styles.exercise}>
      <header className={styles.exHead}>
        <h4 className={styles.exTitle}>{exercise.title || 'תרגיל ללא כותרת'}</h4>
        <Pill label={kindLabel(exercise.kind)} tone="gray" />
        {exercise.tool_hook !== 'none' ? <Pill label={toolHookLabel(exercise.tool_hook)} tone="teal" /> : null}
        {minutes !== null ? <Pill label={`${minutes} ד׳`} tone="outline" /> : null}
      </header>
      {steps.length > 0 ? (
        <ol className={styles.steps}>{steps.map((s, i) => <li key={i}>{s}</li>)}</ol>
      ) : (
        <p className={styles.empty}>אין הוראות לתרגיל.</p>
      )}
      <QuestionBank raw={exercise.questions} />
    </article>
  );
}
