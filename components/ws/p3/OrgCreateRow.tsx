'use client';
import { useState, type KeyboardEvent } from 'react';
import { toast } from '@/lib/store';
import { createOrganization } from '@/lib/ws/orgs';
import type { OrgKind, WsOrganization } from '@/lib/ws/types';
import { dbErrorMessage } from './db-errors';
import { ORG_KIND_OPTIONS } from './options';
import styles from './p3.module.css';

interface OrgCreateRowProps {
  onCreated: (org: WsOrganization) => void;
  onCancel: () => void;
}

const NAME_MIN = 2;
const NAME_MAX = 120;

/** Inline "new organization" row (name, kind, city). Used on /orgs and inside the new-workshop form. */
export function OrgCreateRow({ onCreated, onCancel }: OrgCreateRowProps) {
  const [name, setName] = useState('');
  const [kind, setKind] = useState<OrgKind>('school');
  const [city, setCity] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const trimmed = name.trim();
    if (trimmed.length < NAME_MIN || trimmed.length > NAME_MAX) {
      toast(`שם הארגון: ${NAME_MIN} עד ${NAME_MAX} תווים`);
      return;
    }
    setBusy(true);
    try {
      const org = await createOrganization({ name: trimmed, kind, city: city.trim() || null });
      toast('הארגון נוצר', true);
      onCreated(org);
    } catch (err) {
      toast(dbErrorMessage(err, 'יצירת הארגון נכשלה'));
    } finally {
      setBusy(false);
    }
  };

  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Enter') { e.preventDefault(); void submit(); }
    else if (e.key === 'Escape') onCancel();
  };

  return (
    <div className={`hud ${styles.createRow}`} onKeyDown={onKey}>
      <label>
        <span className="lbl">שם הארגון</span>
        <input type="text" value={name} autoFocus onChange={(e) => setName(e.target.value)} />
      </label>
      <label>
        <span className="lbl">סוג</span>
        <select value={kind} onChange={(e) => setKind(e.target.value as OrgKind)}>
          {ORG_KIND_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </label>
      <label>
        <span className="lbl">עיר</span>
        <input type="text" value={city} onChange={(e) => setCity(e.target.value)} />
      </label>
      <div className={styles.btns}>
        <button type="button" className="primary" disabled={busy || !name.trim()} onClick={() => void submit()}>
          יצירה
        </button>
        <button type="button" className="ghost" disabled={busy} onClick={onCancel}>ביטול</button>
      </div>
    </div>
  );
}
