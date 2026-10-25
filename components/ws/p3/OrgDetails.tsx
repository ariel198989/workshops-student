'use client';
import type { InlineValue } from '../inline-utils';
import { InlineEdit } from '../InlineEdit';
import { updateOrganization, type OrgPatch } from '@/lib/ws/orgs';
import type { WsOrganization } from '@/lib/ws/types';
import { withFriendlyError } from './db-errors';
import { KvField } from './KvField';
import { ORG_KIND_OPTIONS, ORG_STATUS_OPTIONS } from './options';
import styles from './p3.module.css';

interface OrgDetailsProps {
  org: WsOrganization;
  canEdit: boolean;
  onSaved: (org: WsOrganization) => void;
}

type TextKey = 'city' | 'address' | 'external_ref' | 'website' | 'notes';

const TEXT_FIELDS: readonly { key: TextKey; label: string; ltr?: boolean; type?: 'text' | 'textarea'; wide?: boolean }[] = [
  { key: 'city', label: 'עיר' },
  { key: 'address', label: 'כתובת' },
  { key: 'external_ref', label: 'סמל מוסד / מזהה חיצוני', ltr: true },
  { key: 'website', label: 'אתר', ltr: true },
  { key: 'notes', label: 'הערות', type: 'textarea', wide: true },
];

export function OrgDetails({ org, canEdit, onSaved }: OrgDetailsProps) {
  const save = (patch: OrgPatch) => async () => {
    onSaved(await withFriendlyError(() => updateOrganization(org.id, patch)));
  };
  const text = (key: TextKey) => (v: InlineValue) => save({ [key]: v === null ? null : String(v) })();

  return (
    <section className={`hud ${styles.card}`}>
      <div className={styles.cardHead}><h2>פרטי הארגון</h2></div>
      <div className={styles.kv}>
        <KvField label="שם">
          <InlineEdit value={org.name} disabled={!canEdit} ariaLabel="שם הארגון"
            onSave={(v) => { if (!v) throw new Error('שם חובה'); return save({ name: String(v) })(); }} />
        </KvField>
        <KvField label="סוג">
          <InlineEdit type="select" value={org.kind} options={ORG_KIND_OPTIONS} disabled={!canEdit}
            onSave={(v) => save({ kind: v as WsOrganization['kind'] })()} />
        </KvField>
        <KvField label="סטטוס">
          <InlineEdit type="select" value={org.status} options={ORG_STATUS_OPTIONS} disabled={!canEdit}
            onSave={(v) => save({ status: v as WsOrganization['status'] })()} />
        </KvField>
        {TEXT_FIELDS.map((f) => (
          <KvField key={f.key} label={f.label} wide={f.wide}>
            <InlineEdit type={f.type ?? 'text'} value={org[f.key]} ltr={f.ltr} disabled={!canEdit}
              ariaLabel={f.label} onSave={text(f.key)} />
          </KvField>
        ))}
      </div>
    </section>
  );
}
