import type { ReactNode } from 'react';
import styles from './p3.module.css';

interface KvFieldProps {
  label: string;
  wide?: boolean;
  children: ReactNode;
}

/** Label above an InlineEdit (or any read-only value), laid out by the .kv grid. */
export function KvField({ label, wide = false, children }: KvFieldProps) {
  return (
    <div className={wide ? styles.kvWide : undefined}>
      <span className={styles.kvLabel}>{label}</span>
      <div className={styles.kvValue}>{children}</div>
    </div>
  );
}
