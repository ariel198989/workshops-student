import { parseAgendaLine, parseNotes, splitLabel, type NoteSection } from './notes';
import styles from './guide.module.css';

const BULLET = /^\s*[•*]\s*/;

function Lines({ lines }: { lines: string[] }) {
  return (
    <div className={styles.labelled}>
      {lines.map((raw, i) => {
        const line = raw.replace(BULLET, '');
        const labelled = splitLabel(line);
        return labelled
          ? <p key={i}><b>{labelled.label}:</b> {labelled.value}</p>
          : <p key={i} className={styles.noteLine}>{line}</p>;
      })}
    </div>
  );
}

function AgendaRows({ lines }: { lines: string[] }) {
  return (
    <div className={styles.agendaRows}>
      {lines.map((line, i) => {
        const row = parseAgendaLine(line);
        if (!row) return <p key={i} className={styles.noteLine}>{line}</p>;
        return (
          <div key={i} className={styles.agendaRow}>
            <span className={styles.agendaMin}>{row.minutes} ד׳</span>
            <div>
              <div className={styles.agendaTitle}>{row.title}</div>
              {row.text ? <div className={styles.agendaText}>{row.text}</div> : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}

const isAgenda = (s: NoteSection): boolean => s.lines.every((l) => parseAgendaLine(l) !== null);

/** Renders facilitator_notes: "── X ──" markers become small headings, timed lines become an agenda. */
export function NotesView({ notes }: { notes: string | null }) {
  const sections = parseNotes(notes);
  if (sections.length === 0) return <p className={styles.empty}>אין הערות למנחה.</p>;
  return (
    <>
      {sections.map((s, i) => (
        <div key={i} className={styles.noteBlock}>
          {s.title ? <h4 className={styles.noteTitle}>{s.title}</h4> : null}
          {isAgenda(s) ? <AgendaRows lines={s.lines} /> : <Lines lines={s.lines} />}
        </div>
      ))}
    </>
  );
}
