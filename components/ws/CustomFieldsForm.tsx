'use client';
import { useEffect, useState } from 'react';
import { toast } from '@/lib/store';
import { listFieldDefinitions } from '@/lib/ws/orgs';
import type { FieldEntity, JsonObject, WsFieldDefinition } from '@/lib/ws/types';
import { FIELD_RENDERERS, optionList, setField, validateCustomFields } from './field-utils';
import styles from './ws.module.css';

interface CustomFieldsFormProps {
  entity: FieldEntity;
  organizationId?: string;
  value: JsonObject;
  onChange: (next: JsonObject) => void;
  /** show validation messages (set after the first submit attempt) */
  showErrors?: boolean;
  disabled?: boolean;
}

interface FieldProps {
  def: WsFieldDefinition;
  value: unknown;
  disabled: boolean;
  onChange: (next: unknown) => void;
}

function FieldControl({ def, value, disabled, onChange }: FieldProps) {
  const options = optionList(def.options);
  const id = `cf-${def.id}`;
  switch (FIELD_RENDERERS[def.field_type]) {
    case 'checkbox':
      return (
        <label className={styles.checkRow}>
          <input type="checkbox" checked={value === true} disabled={disabled}
            onChange={(e) => onChange(e.target.checked)} />
          <span>{def.label}</span>
        </label>
      );
    case 'select':
      return (
        <select id={id} value={typeof value === 'string' ? value : ''} disabled={disabled}
          onChange={(e) => onChange(e.target.value)}>
          <option value="">-</option>
          {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      );
    case 'chips': {
      const picked = Array.isArray(value) ? (value as unknown[]).filter((v): v is string => typeof v === 'string') : [];
      const toggle = (v: string) => onChange(picked.includes(v) ? picked.filter((x) => x !== v) : [...picked, v]);
      return (
        <div className={styles.optionChips} role="group" aria-label={def.label}>
          {options.map((o) => (
            <button key={o.value} type="button" disabled={disabled} aria-pressed={picked.includes(o.value)}
              className={`${styles.optionChip} ${picked.includes(o.value) ? styles.optionOn : ''}`}
              onClick={() => toggle(o.value)}>
              {o.label}
            </button>
          ))}
        </div>
      );
    }
    case 'number':
      return (
        <input id={id} type="number" value={typeof value === 'number' ? value : ''} disabled={disabled}
          onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))} />
      );
    case 'date':
      return (
        <input id={id} type="date" value={typeof value === 'string' ? value.slice(0, 10) : ''} disabled={disabled}
          onChange={(e) => onChange(e.target.value)} />
      );
    case 'url':
      return (
        <input id={id} type="text" dir="ltr" inputMode="url" placeholder="https://" disabled={disabled}
          value={typeof value === 'string' ? value : ''} onChange={(e) => onChange(e.target.value)} />
      );
    default:
      return (
        <input id={id} type="text" value={typeof value === 'string' ? value : ''} disabled={disabled}
          onChange={(e) => onChange(e.target.value)} />
      );
  }
}

/** Renders ws_field_definitions (global + org) by field_type; the parent owns the jsonb value. */
export function CustomFieldsForm({
  entity, organizationId, value, onChange, showErrors = false, disabled = false,
}: CustomFieldsFormProps) {
  const [defs, setDefs] = useState<WsFieldDefinition[] | null>(null);

  useEffect(() => {
    let live = true;
    listFieldDefinitions(entity, organizationId)
      .then((rows) => { if (live) setDefs(rows); })
      .catch(() => { if (live) { setDefs([]); toast('טעינת השדות המותאמים נכשלה'); } });
    return () => { live = false; };
  }, [entity, organizationId]);

  if (defs === null) return <p className="hint">טוען שדות...</p>;
  if (defs.length === 0) return null;

  const errors = showErrors ? validateCustomFields(defs, value) : {};
  return (
    <div className={styles.fields}>
      {defs.map((def) => {
        const boolean = def.field_type === 'boolean';
        return (
          <div key={def.id} className={def.field_type === 'multiselect' ? styles.fieldWide : undefined}>
            {boolean ? null : (
              <label className="lbl" htmlFor={`cf-${def.id}`}>
                {def.label}{def.required ? <span className={styles.req} aria-hidden="true">*</span> : null}
              </label>
            )}
            <FieldControl def={def} value={value[def.key]} disabled={disabled}
              onChange={(next) => onChange(setField(value, def.key, next))} />
            <p className={styles.fieldErr} role={errors[def.key] ? 'alert' : undefined}>{errors[def.key] ?? ''}</p>
          </div>
        );
      })}
    </div>
  );
}
