'use client';
import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { toast } from '@/lib/store';
import { parseInlineValue, sameValue, toInputValue, type InlineType, type InlineValue } from './inline-utils';
import styles from './ws.module.css';

export interface InlineOption { value: string; label: string }

interface InlineEditProps {
  value: InlineValue;
  onSave: (value: InlineValue) => Promise<unknown> | void;
  type?: InlineType;
  options?: readonly InlineOption[];
  disabled?: boolean;
  placeholder?: string;
  /** custom read-only rendering of the current value */
  display?: (value: InlineValue) => ReactNode;
  /** codes and emails */
  ltr?: boolean;
  ariaLabel?: string;
}

const SAVE_ERROR = 'השמירה נכשלה, הערך הוחזר';
const BAD_VALUE = 'ערך לא תקין';

export function InlineEdit({
  value, onSave, type = 'text', options = [], disabled = false, placeholder = 'לחצו להוספה',
  display, ltr = false, ariaLabel,
}: InlineEditProps) {
  const [shown, setShown] = useState<InlineValue>(value);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [pending, setPending] = useState(false);
  const skipBlur = useRef(false);
  const field = useRef<HTMLElement | null>(null);
  const setField = (el: HTMLElement | null) => { field.current = el; };

  // follow the parent when it refetches (not while the user is typing or a save is in flight)
  useEffect(() => {
    if (!editing && !pending) setShown(value);
  }, [value, editing, pending]);

  useEffect(() => {
    if (editing) field.current?.focus();
  }, [editing]);

  const begin = () => {
    if (disabled || pending) return;
    skipBlur.current = false;
    setDraft(toInputValue(type, shown));
    setEditing(true);
  };

  const cancel = () => {
    skipBlur.current = true;
    setEditing(false);
  };

  const commit = async (raw: string) => {
    const parsed = parseInlineValue(type, raw);
    setEditing(false);
    if (!parsed.ok) { toast(BAD_VALUE); return; }
    if (sameValue(parsed.value, shown)) return;
    const previous = shown;
    setShown(parsed.value);
    setPending(true);
    try {
      await onSave(parsed.value);
    } catch (err) {
      setShown(previous);
      toast(err instanceof Error && err.message ? `${SAVE_ERROR}: ${err.message}` : SAVE_ERROR);
    } finally {
      setPending(false);
    }
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') { e.preventDefault(); cancel(); }
    else if (e.key === 'Enter' && !(type === 'textarea' && e.shiftKey)) {
      e.preventDefault();
      skipBlur.current = true;
      void commit(draft);
    }
  };

  const onBlur = () => {
    if (skipBlur.current) { skipBlur.current = false; return; }
    void commit(draft);
  };

  if (editing) {
    const common = {
      ref: setField, value: draft, onKeyDown, onBlur, dir: ltr ? 'ltr' : undefined, 'aria-label': ariaLabel,
    } as const;
    const set = (v: string) => setDraft(v);
    return (
      <span className={`${styles.inline} ${styles.inlineField}`}>
        {type === 'textarea' ? <textarea {...common} onChange={(e) => set(e.target.value)} />
          : type === 'select' ? (
            <select {...common} onChange={(e) => set(e.target.value)}>
              <option value="">-</option>
              {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          ) : (
            <input {...common} onChange={(e) => set(e.target.value)}
              type={type === 'datetime' ? 'datetime-local' : type === 'number' ? 'number' : type === 'date' ? 'date' : 'text'} />
          )}
      </span>
    );
  }

  const label = type === 'select' ? options.find((o) => o.value === shown)?.label ?? shown : shown;
  const content = display ? display(shown) : label === null || label === '' ? null : String(label);
  return (
    <button type="button" className={`${styles.inlineView} ${pending ? styles.pending : ''}`} onClick={begin}
      disabled={disabled} dir={ltr ? 'ltr' : undefined} aria-label={ariaLabel}>
      {content ?? <span className={styles.placeholder}>{disabled ? '-' : placeholder}</span>}
    </button>
  );
}
