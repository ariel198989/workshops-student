'use client';
import { useEffect, useState } from 'react';
import { toast } from '@/lib/store';
import styles from './ws.module.css';

export type ConfirmTone = 'default' | 'primary' | 'hot' | 'danger';

interface ConfirmButtonProps {
  label: string;
  /** the question shown in the second step, e.g. "לעבור למצב חי?" */
  confirmText?: string;
  onConfirm: () => Promise<unknown> | void;
  tone?: ConfirmTone;
  disabled?: boolean;
  small?: boolean;
}

const TONE_CLASS: Record<ConfirmTone, string> = { default: '', primary: 'primary', hot: 'hot', danger: 'danger' };
const FAIL = 'הפעולה נכשלה';

/** Two-step inline confirm: the button turns into "question / yes / no". Esc backs out. */
export function ConfirmButton({
  label, confirmText = 'בטוח?', onConfirm, tone = 'default', disabled = false, small = false,
}: ConfirmButtonProps) {
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const size = small ? ' sm' : '';

  useEffect(() => {
    if (!asking) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAsking(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [asking]);

  const run = async () => {
    setBusy(true);
    try {
      await onConfirm();
    } catch (err) {
      toast(err instanceof Error && err.message ? `${FAIL}: ${err.message}` : FAIL);
    } finally {
      setBusy(false);
      setAsking(false);
    }
  };

  if (!asking) {
    return (
      <button type="button" className={`${TONE_CLASS[tone]}${size}`.trim()} disabled={disabled}
        onClick={() => setAsking(true)}>
        {label}
      </button>
    );
  }
  return (
    <span className={styles.confirm} role="group" aria-label={label}>
      <span className={styles.confirmText}>{confirmText}</span>
      <button type="button" className={`${TONE_CLASS[tone] || 'primary'}${size}`.trim()} disabled={busy}
        onClick={() => void run()} autoFocus>
        כן
      </button>
      <button type="button" className={`ghost${size}`} disabled={busy} onClick={() => setAsking(false)}>לא</button>
    </span>
  );
}
