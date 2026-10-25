'use client';
import { useState } from 'react';
import type { WsOrganization } from '@/lib/ws/types';
import { OrgCreateRow } from './OrgCreateRow';
import styles from './p3.module.css';

interface OrgPickerProps {
  orgs: readonly WsOrganization[];
  value: string;
  onChange: (id: string) => void;
  /** called with the freshly created organization so the parent can add it to its list */
  onCreated: (org: WsOrganization) => void;
  error?: string;
}

/** Organization select with an inline "+ ארגון חדש" row (no modal). */
export function OrgPicker({ orgs, value, onChange, onCreated, error }: OrgPickerProps) {
  const [adding, setAdding] = useState(false);
  return (
    <div>
      <div className={styles.orgPick}>
        <select id="ws-org" value={value} aria-invalid={error ? true : undefined} onChange={(e) => onChange(e.target.value)}>
          <option value="">בחירת ארגון</option>
          {orgs.filter((o) => o.status !== 'archived').map((o) => (
            <option key={o.id} value={o.id}>{o.city ? `${o.name} · ${o.city}` : o.name}</option>
          ))}
        </select>
        {adding ? null : <button type="button" onClick={() => setAdding(true)}>+ ארגון חדש</button>}
      </div>
      <p className={styles.fieldErr} role={error ? 'alert' : undefined}>{error ?? ''}</p>
      {adding ? (
        <OrgCreateRow onCancel={() => setAdding(false)}
          onCreated={(org) => { setAdding(false); onCreated(org); onChange(org.id); }} />
      ) : null}
    </div>
  );
}
