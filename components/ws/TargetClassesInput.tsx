'use client';
import { useState, type ClipboardEvent, type KeyboardEvent } from 'react';
import {
  addTargetClasses, isOverRecommended, removeTargetClass, TARGET_CLASSES_HINT,
} from './target-classes';
import styles from './ws.module.css';

interface TargetClassesInputProps {
  value: readonly string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
  ariaLabel?: string;
}

/** Chips input. Normalization (trim, dedupe, quotes, 40 chars) is lib/ws/workshops normalizeTargetClasses. */
export function TargetClassesInput({ value, onChange, disabled = false, ariaLabel = 'אובייקטי יעד' }: TargetClassesInputProps) {
  const [draft, setDraft] = useState('');

  const flush = (raw: string) => {
    if (raw.trim()) onChange(addTargetClasses(value, raw));
    setDraft('');
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      flush(draft);
    } else if (e.key === 'Backspace' && draft === '' && value.length > 0) {
      onChange(removeTargetClass(value, value.length - 1));
    }
  };

  const onPaste = (e: ClipboardEvent<HTMLInputElement>) => {
    const text = e.clipboardData.getData('text');
    if (/[,\n\r]/.test(text)) {
      e.preventDefault();
      flush(draft + text);
    }
  };

  return (
    <div>
      <div className={styles.chipsBox}>
        {value.map((cls, i) => (
          <span key={cls.toLowerCase()} className={styles.chip}>
            <span dir="auto">{cls}</span>
            {disabled ? null : (
              <button type="button" className={styles.chipX} aria-label={`הסרת ${cls}`}
                onClick={() => onChange(removeTargetClass(value, i))}>
                ×
              </button>
            )}
          </span>
        ))}
        {disabled ? null : (
          <input type="text" value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={onKeyDown}
            onPaste={onPaste} onBlur={() => flush(draft)} aria-label={ariaLabel}
            placeholder={value.length === 0 ? 'הקלידו שם והקישו Enter' : ''} />
        )}
      </div>
      <p className={isOverRecommended(value) ? styles.hintOver : styles.hintOk}>{TARGET_CLASSES_HINT}</p>
    </div>
  );
}
