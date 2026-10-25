'use client';
import { updateWorkshop } from '@/lib/ws/workshops';
import type { WorkshopPatch, WsWorkshop } from '@/lib/ws/types';
import { InlineEdit } from '../InlineEdit';
import type { InlineValue } from '../inline-utils';
import { withFriendlyError } from './db-errors';
import { KvField } from './KvField';
import { DEVICE_OPTIONS } from './options';
import { normalizeCode, validateCode, validateTeamPrefix } from './workshop-utils';
import styles from './p3.module.css';

interface WorkshopFieldsProps {
  workshop: WsWorkshop;
  canEdit: boolean;
  /** code and team_prefix: locked once a group is activated, and for non-admins */
  identityLocked: boolean;
  onSaved: (next: WsWorkshop) => void;
}

type TextKey = 'grade_level' | 'class_label' | 'homeroom_teacher' | 'location';
type NumKey = 'audience_size' | 'tablets_count';

const TEXT: readonly { key: TextKey; label: string }[] = [
  { key: 'grade_level', label: 'שכבה' }, { key: 'class_label', label: 'כיתה' },
  { key: 'homeroom_teacher', label: 'מחנך/ת' }, { key: 'location', label: 'מיקום' },
];
const NUM: readonly { key: NumKey; label: string }[] = [
  { key: 'audience_size', label: 'מספר משתתפים' }, { key: 'tablets_count', label: 'מספר טאבלטים' },
];

export function WorkshopFields({ workshop: w, canEdit, identityLocked, onSaved }: WorkshopFieldsProps) {
  const save = async (patch: WorkshopPatch) => {
    onSaved(await withFriendlyError(() => updateWorkshop(w.id, patch)));
  };
  const text = (key: TextKey) => (v: InlineValue) => save({ [key]: v === null ? null : String(v) });
  const num = (key: NumKey) => (v: InlineValue) => save({ [key]: v === null ? null : Number(v) });
  const off = !canEdit;

  return (
    <section className={`hud ${styles.card}`}>
      <div className={styles.cardHead}><h2>פרטי הסדנה</h2></div>
      <div className={styles.kv}>
        <KvField label="כותרת" wide>
          <InlineEdit value={w.title} disabled={off} ariaLabel="כותרת"
            onSave={(v) => { if (!v || String(v).trim().length < 2) throw new Error('כותרת: לפחות 2 תווים'); return save({ title: String(v).trim() }); }} />
        </KvField>
        <KvField label="קוד">
          <InlineEdit value={w.code} ltr disabled={off || identityLocked} ariaLabel="קוד"
            onSave={(v) => {
              const code = normalizeCode(String(v ?? ''));
              const bad = validateCode(code);
              if (bad) throw new Error(bad);
              return save({ code });
            }} />
        </KvField>
        <KvField label="קידומת קבוצות">
          <InlineEdit value={w.team_prefix} disabled={off || identityLocked} ariaLabel="קידומת קבוצות"
            onSave={(v) => {
              const bad = validateTeamPrefix(String(v ?? ''));
              if (bad) throw new Error(bad);
              return save({ team_prefix: String(v).trim() });
            }} />
        </KvField>
        <KvField label="תאריך התחלה">
          <InlineEdit type="date" value={w.starts_on} disabled={off} onSave={(v) => save({ starts_on: v === null ? null : String(v) })} />
        </KvField>
        <KvField label="תאריך סיום">
          <InlineEdit type="date" value={w.ends_on} disabled={off} onSave={(v) => save({ ends_on: v === null ? null : String(v) })} />
        </KvField>
        {TEXT.map((f) => (
          <KvField key={f.key} label={f.label}>
            <InlineEdit value={w[f.key]} disabled={off} ariaLabel={f.label} onSave={text(f.key)} />
          </KvField>
        ))}
        {NUM.map((f) => (
          <KvField key={f.key} label={f.label}>
            <InlineEdit type="number" value={w[f.key]} disabled={off} ariaLabel={f.label} onSave={num(f.key)} />
          </KvField>
        ))}
        <KvField label="גודל קבוצה">
          <InlineEdit type="number" value={w.group_size} disabled={off} ariaLabel="גודל קבוצה"
            onSave={(v) => {
              const n = Number(v);
              if (!Number.isInteger(n) || n < 2 || n > 8) throw new Error('גודל קבוצה בין 2 ל-8');
              return save({ group_size: n });
            }} />
        </KvField>
        <KvField label="מכשירים">
          <InlineEdit type="select" value={w.device_mode} options={DEVICE_OPTIONS} disabled={off}
            onSave={(v) => save({ device_mode: v as WsWorkshop['device_mode'] })} />
        </KvField>
        <KvField label="הערות" wide>
          <InlineEdit type="textarea" value={w.notes} disabled={off} ariaLabel="הערות"
            onSave={(v) => save({ notes: v === null ? null : String(v) })} />
        </KvField>
      </div>
      {identityLocked ? (
        <p className={styles.lockNote}>הקוד והקידומת ננעלים אחרי הפעלת הקבוצות, כי הם מזהים את הנתונים באפליקציית Smart City.</p>
      ) : null}
    </section>
  );
}
