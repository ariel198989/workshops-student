import { PREFIX_MAX, teamNamePreview, validateTeamPrefix } from './workshop-utils';
import styles from './p3.module.css';

interface TeamPrefixFieldProps {
  value: string;
  onChange: (next: string) => void;
  disabled?: boolean;
  /** external error (e.g. submit-time); live validation shows once the field has content */
  error?: string;
}

/** Team prefix input with the live "{prefix} · קבוצה 1" preview and instant rule feedback. */
export function TeamPrefixField({ value, onChange, disabled = false, error }: TeamPrefixFieldProps) {
  const live = value.trim() ? validateTeamPrefix(value) : null;
  const message = live ?? error ?? '';
  return (
    <div>
      <input id="ws-prefix" type="text" value={value} maxLength={PREFIX_MAX + 6} disabled={disabled}
        aria-invalid={message ? true : undefined} placeholder="לדוגמה: אופק ח2 תשפ״ז"
        onChange={(e) => onChange(e.target.value)} />
      <p className={message ? styles.fieldErr : styles.fieldHint} role={message ? 'alert' : undefined}>
        {message || (value.trim()
          ? <span className={styles.preview}>שם הקבוצה באפליקציה: <span className={styles.previewTag}>{teamNamePreview(value)}</span></span>
          : 'מזהה את הקבוצות באפליקציה. לא ניתן לשנות אחרי הפעלה.')}
      </p>
    </div>
  );
}
