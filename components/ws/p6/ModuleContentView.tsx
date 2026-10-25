import type { ReactNode } from 'react';
import { Pill } from '../StatusPill';
import type { WsModule } from '@/lib/ws/types';
import { ExerciseView } from './ExerciseView';
import { NotesView } from './NotesView';
import { materialKindLabel, stageLabel, typeLabel, typeTone } from './labels';
import { readExercises, readMaterials } from './module-form';
import { parseAgenda } from './notes';
import styles from './guide.module.css';

function Section({ title, count, children }: { title: string; count?: number; children: ReactNode }) {
  return (
    <section className={styles.section}>
      <h3 className={styles.sectionTitle}>
        {title}{count !== undefined ? <span className={styles.sectionCount}>{count}</span> : null}
      </h3>
      {children}
    </section>
  );
}

function Summary({ text }: { text: string | null }) {
  const chips = parseAgenda(text);
  if (chips.length > 0) {
    return (
      <Section title="סדר יום" count={chips.length}>
        <div className={styles.chips}>
          {chips.map((c, i) => (
            <span key={i} className={styles.chipItem}>
              {c.title}{c.minutes !== null ? <span className={styles.chipMin}>{c.minutes} ד׳</span> : null}
            </span>
          ))}
        </div>
      </Section>
    );
  }
  return text ? <p className={styles.summaryText}>{text}</p> : null;
}

/** Read view of a module, laid out as a facilitator guide for use in class. */
export function ModuleContentView({ module: m }: { module: WsModule }) {
  const exercises = readExercises(m.exercises);
  const materials = readMaterials(m.materials);
  return (
    <div className={styles.guide}>
      <header className={styles.head}>
        <h2>{m.title}</h2>
        <div className={styles.meta}>
          <Pill label={typeLabel(m.module_type)} tone={typeTone(m.module_type)} />
          {m.pipeline_stage ? <Pill label={stageLabel(m.pipeline_stage)} tone="outline" /> : null}
          <span className={styles.metaItem}>{m.duration_minutes} דקות</span>
          {m.requires_app ? <Pill label="דורש אפליקציה" tone="blue" /> : null}
          <span className={styles.version}>גרסה {m.version}</span>
        </div>
      </header>

      <Summary text={m.summary} />

      {m.objectives.length > 0 ? (
        <Section title="מטרות" count={m.objectives.length}>
          <ul className={styles.objectives}>{m.objectives.map((o, i) => <li key={i}>{o}</li>)}</ul>
        </Section>
      ) : null}

      {exercises.length > 0 ? (
        <Section title="תרגילים" count={exercises.length}>
          {exercises.map((x, i) => <ExerciseView key={i} exercise={x} />)}
        </Section>
      ) : null}

      {materials.length > 0 ? (
        <Section title="חומרים וציוד" count={materials.length}>
          <ul className={styles.materials}>
            {materials.map((x, i) => (
              <li key={i} className={styles.material}>
                <label>
                  <input type="checkbox" />
                  <span className={styles.matLabel}>{x.label}</span>
                  <span className={styles.matKind}>{materialKindLabel(x.kind)}</span>
                </label>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      <Section title="הערות למנחה">
        <NotesView notes={m.facilitator_notes} />
      </Section>
    </div>
  );
}
