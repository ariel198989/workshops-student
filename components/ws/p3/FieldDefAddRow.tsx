'use client';
import { useState } from 'react';
import { toast } from '@/lib/store';
import { saveFieldDefinition } from '@/lib/ws/orgs';
import type { FieldEntity, FieldType, WsFieldDefinition } from '@/lib/ws/types';
import { dbErrorMessage } from './db-errors';
import { needsOptions, parseOptions, validateFieldKey } from './fielddef-utils';
import { FIELD_TYPE_OPTIONS } from './options';
import styles from './p3.module.css';

interface FieldDefAddRowProps {
  entity: FieldEntity;
  /** null = global definition */
  organizationId: string | null;
  nextPosition: number;
  onAdded: (def: WsFieldDefinition) => void;
}

export function FieldDefAddRow({ entity, organizationId, nextPosition, onAdded }: FieldDefAddRowProps) {
  const [label, setLabel] = useState('');
  const [key, setKey] = useState('');
  const [type, setType] = useState<FieldType>('text');
  const [options, setOptions] = useState('');
  const [required, setRequired] = useState(false);
  const [busy, setBusy] = useState(false);

  const add = async () => {
    const keyError = validateFieldKey(key);
    if (keyError) { toast(keyError); return; }
    setBusy(true);
    try {
      const def = await saveFieldDefinition({
        entity, key, label: label.trim(), field_type: type, required, position: nextPosition,
        organization_id: organizationId, options: needsOptions(type) ? parseOptions(options) : [],
      });
      onAdded(def);
      setLabel(''); setKey(''); setOptions(''); setRequired(false); setType('text');
    } catch (err) {
      toast(dbErrorMessage(err, 'הוספת השדה נכשלה'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={`hud ${styles.createRow}`}>
      <label>
        <span className="lbl">שם השדה</span>
        <input type="text" value={label} onChange={(e) => setLabel(e.target.value)} />
      </label>
      <label>
        <span className="lbl">מפתח (באנגלית)</span>
        <input type="text" dir="ltr" value={key} placeholder="school_code"
          onChange={(e) => setKey(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))} />
      </label>
      <label>
        <span className="lbl">סוג</span>
        <select value={type} onChange={(e) => setType(e.target.value as FieldType)}>
          {FIELD_TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </label>
      {needsOptions(type) ? (
        <label>
          <span className="lbl">אפשרויות (מופרדות בפסיק)</span>
          <input type="text" value={options} onChange={(e) => setOptions(e.target.value)} />
        </label>
      ) : null}
      <label className={styles.checkInline}>
        <input type="checkbox" checked={required} onChange={(e) => setRequired(e.target.checked)} />
        חובה
      </label>
      <div className={styles.btns}>
        <button type="button" className="primary" disabled={busy || !label.trim() || !key} onClick={() => void add()}>
          + שדה חדש
        </button>
      </div>
    </div>
  );
}
