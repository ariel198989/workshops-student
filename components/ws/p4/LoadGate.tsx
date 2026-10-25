'use client';
import type { ReactNode } from 'react';
import { Spinner } from '@/components/ui/Spinner';
import styles from './flow.module.css';

interface LoadGateProps {
  loading: boolean;
  error: string | null;
  hasData: boolean;
  onRetry: () => void;
  children: ReactNode;
}

/** First-load spinner and a retry box; once data exists, children stay on screen even if a refresh fails. */
export function LoadGate({ loading, error, hasData, onRetry, children }: LoadGateProps) {
  if (hasData) return <>{children}</>;
  if (loading) {
    return (
      <div className={styles.center}>
        <Spinner large />
      </div>
    );
  }
  return (
    <section className={`hud ${styles.errorBox}`} role="alert">
      <p>{error ?? 'הטעינה נכשלה'}</p>
      <button type="button" onClick={onRetry}>נסו שוב</button>
    </section>
  );
}
