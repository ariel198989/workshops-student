import type { ReactNode } from 'react';
import styles from './p5.module.css';

interface FieldProps {
  label: string;
  children: ReactNode;
  wide?: boolean;
}

/** Label above a value; used by the problem and deliverable cards. */
export function Field({ label, children, wide = false }: FieldProps) {
  return (
    <div className={wide ? styles.fieldWide : styles.field}>
      <span className="lbl">{label}</span>
      <div className={styles.fieldBody}>{children}</div>
    </div>
  );
}
