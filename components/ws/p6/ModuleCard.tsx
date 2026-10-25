import { Pill } from '../StatusPill';
import type { WsModule } from '@/lib/ws/types';
import { stageLabel, typeLabel, typeTone } from './labels';
import styles from './library.module.css';

interface Props { module: WsModule; selected: boolean; onSelect: (id: string) => void }

/** One row of the module list: title, type pill, stage, duration, app chip. */
export function ModuleCard({ module: m, selected, onSelect }: Props) {
  return (
    <button type="button" className={`${styles.card} ${selected ? styles.cardOn : ''}`}
      aria-pressed={selected} onClick={() => onSelect(m.id)}>
      <span className={styles.cardTitle}>{m.title}</span>
      <span className={styles.cardMeta}>
        <Pill label={typeLabel(m.module_type)} tone={typeTone(m.module_type)} />
        {m.pipeline_stage ? <span>{stageLabel(m.pipeline_stage)}</span> : null}
        <span>{m.duration_minutes} ד׳</span>
        {m.requires_app ? <Pill label="דורש אפליקציה" tone="blue" /> : null}
      </span>
    </button>
  );
}
