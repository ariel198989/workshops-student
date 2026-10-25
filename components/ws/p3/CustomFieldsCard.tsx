'use client';
import { useEffect, useState } from 'react';
import { toast } from '@/lib/store';
import { listFieldDefinitions } from '@/lib/ws/orgs';
import type { FieldEntity, JsonObject, WsFieldDefinition } from '@/lib/ws/types';
import { CustomFieldsForm } from '../CustomFieldsForm';
import { validateCustomFields } from '../field-utils';
import { dbErrorMessage } from './db-errors';
import styles from './p3.module.css';

interface CustomFieldsCardProps {
  entity: FieldEntity;
  organizationId?: string;
  value: JsonObject;
  disabled?: boolean;
  /** persists the whole custom_fields object */
  onSave: (next: JsonObject) => Promise<unknown>;
}

/** CustomFieldsForm plus an explicit save button; hidden entirely when no field definitions exist. */
export function CustomFieldsCard({ entity, organizationId, value, disabled = false, onSave }: CustomFieldsCardProps) {
  const [draft, setDraft] = useState<JsonObject>(value);
  const [defs, setDefs] = useState<WsFieldDefinition[]>([]);
  const [showErrors, setShowErrors] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => { setDraft(value); }, [value]);
  useEffect(() => {
    let live = true;
    listFieldDefinitions(entity, organizationId).then((rows) => { if (live) setDefs(rows); }).catch(() => undefined);
    return () => { live = false; };
  }, [entity, organizationId]);

  if (defs.length === 0) return null;

  const dirty = JSON.stringify(draft) !== JSON.stringify(value);
  const save = async () => {
    setShowErrors(true);
    if (Object.keys(validateCustomFields(defs, draft)).length > 0) return;
    setBusy(true);
    try {
      await onSave(draft);
      toast('השדות נשמרו', true);
    } catch (err) {
      toast(dbErrorMessage(err, 'שמירת השדות נכשלה'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className={`hud ${styles.card}`}>
      <div className={styles.cardHead}>
        <h2>שדות מותאמים</h2>
        {disabled ? null : (
          <button type="button" className="primary sm" disabled={busy || !dirty} onClick={() => void save()}>שמירה</button>
        )}
      </div>
      <CustomFieldsForm entity={entity} organizationId={organizationId} value={draft} onChange={setDraft}
        showErrors={showErrors} disabled={disabled || busy} />
    </section>
  );
}
