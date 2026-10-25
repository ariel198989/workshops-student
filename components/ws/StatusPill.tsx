import { labelOf, pillTone, type PillKind, type PillTone } from '@/lib/ws/labels';
import styles from './ws.module.css';

interface PillProps {
  label: string;
  tone: PillTone;
  /** pulsing dot, used for live states */
  live?: boolean;
}

/** Raw pill for callers that already hold a label and tone (e.g. staff roles). */
export function Pill({ label, tone, live = false }: PillProps) {
  const cls = [styles.pill, styles[tone], live ? styles.live : ''].filter(Boolean).join(' ');
  return (
    <span className={cls}>
      {live ? <span className={styles.dot} aria-hidden="true" /> : null}
      {label}
    </span>
  );
}

interface StatusPillProps {
  kind: PillKind;
  value: string;
}

/** Hebrew label and tone come from lib/ws/labels.ts; unknown values fall back to a gray raw label. */
export function StatusPill({ kind, value }: StatusPillProps) {
  return <Pill label={labelOf(kind, value)} tone={pillTone(kind, value)} live={value === 'live'} />;
}
