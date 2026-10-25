import { formatDateHe } from '@/lib/ws/certificate-templates';
import type { WsDeliverable } from '@/lib/ws/types';
import { readDatasetSnapshot, readModelSnapshot } from './snapshot';
import styles from './p5.module.css';

interface SnapshotSummaryProps {
  deliverable: Pick<WsDeliverable, 'model_snapshot' | 'dataset_snapshot' | 'locked_at'>;
}

/** What was frozen when the deliverable was locked. */
export function SnapshotSummary({ deliverable }: SnapshotSummaryProps) {
  const model = readModelSnapshot(deliverable.model_snapshot);
  const data = readDatasetSnapshot(deliverable.dataset_snapshot);
  return (
    <section className={styles.snapshot} aria-label="תמונת מצב קפואה">
      <h4>נקודת הקפאה, {formatDateHe(deliverable.locked_at)}</h4>
      <div className={styles.snapGrid}>
        <div>
          <span className="lbl">מודל</span>
          {model ? (
            <ul className={styles.plain}>
              <li dir="auto" className="ink">{model.name || 'ללא שם'}</li>
              <li>דיוק: {model.accuracyPct === null ? '-' : `${model.accuracyPct}%`}</li>
              <li>תמונות באימון: {model.imageCount ?? '-'}</li>
              <li>{model.honestVal ? 'אומת על סט בדיקה נפרד' : 'ללא סט בדיקה נפרד'}</li>
              {model.classes.length > 0 ? <li dir="auto">אובייקטים: {model.classes.join(', ')}</li> : null}
            </ul>
          ) : <p className="hint">לא נבחר מודל בעת הנעילה.</p>}
        </div>
        <div>
          <span className="lbl">דאטה</span>
          {data ? (
            <ul className={styles.plain}>
              <li>תמונות: <span className="num">{data.photos}</span></li>
              <li>מתויגות: <span className="num">{data.tagged}</span></li>
              <li>משתתפים שצילמו: <span className="num">{data.contributors}</span></li>
              {data.coverage.map((c) => <li key={c.name} dir="auto">{c.name}: {c.tagged}</li>)}
            </ul>
          ) : <p className="hint">אין נתוני דאטה.</p>}
        </div>
      </div>
    </section>
  );
}
