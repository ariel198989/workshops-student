'use client';
import { moveAt, removeAt, replaceAt } from './module-form';
import styles from './editor.module.css';

interface ListEditorProps {
  items: readonly string[];
  onChange: (items: string[]) => void;
  addLabel: string;
  placeholder?: string;
  ariaLabel: string;
}

/** Editable list of short texts with add, remove and reorder. Used for objectives. */
export function ListEditor({ items, onChange, addLabel, placeholder, ariaLabel }: ListEditorProps) {
  return (
    <div className={styles.group}>
      {items.map((text, i) => (
        <div key={i} className={styles.listRow}>
          <input type="text" value={text} placeholder={placeholder} aria-label={`${ariaLabel} ${i + 1}`}
            onChange={(e) => onChange(replaceAt(items, i, e.target.value))} />
          <span className={styles.rowTools}>
            <button type="button" className="ghost sm" disabled={i === 0} aria-label="העלאה"
              onClick={() => onChange(moveAt(items, i, i - 1))}>▲</button>
            <button type="button" className="ghost sm" disabled={i === items.length - 1} aria-label="הורדה"
              onClick={() => onChange(moveAt(items, i, i + 1))}>▼</button>
            <button type="button" className="ghost sm" aria-label="הסרה"
              onClick={() => onChange(removeAt(items, i))}>הסרה</button>
          </span>
        </div>
      ))}
      <div><button type="button" className="sm" onClick={() => onChange([...items, ''])}>{addLabel}</button></div>
    </div>
  );
}
