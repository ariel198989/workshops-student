'use client';
import { useMemo, useState } from 'react';
import { toast } from '@/lib/store';
import { deleteContact, upsertContact } from '@/lib/ws/orgs';
import type { WsContact } from '@/lib/ws/types';
import { ConfirmButton } from '../ConfirmButton';
import { DataTable, type Column } from '../DataTable';
import { InlineEdit } from '../InlineEdit';
import { Pill } from '../StatusPill';
import { dbErrorMessage, withFriendlyError } from './db-errors';
import styles from './p3.module.css';

interface OrgContactsProps {
  orgId: string;
  contacts: readonly WsContact[];
  canEdit: boolean;
  onChange: (next: WsContact[]) => void;
}

type Editable = 'full_name' | 'role_title' | 'email' | 'phone';
const BLANK = { full_name: '', role_title: '', email: '', phone: '' };

const replace = (list: readonly WsContact[], row: WsContact): WsContact[] =>
  list.map((c) => (c.id === row.id ? row : c));

// the unique partial index allows one primary: clear the old one before setting the new one
async function makePrimary(orgId: string, contacts: readonly WsContact[], target: WsContact): Promise<WsContact[]> {
  const previous = contacts.find((c) => c.is_primary && c.id !== target.id);
  let next = [...contacts];
  if (previous) next = replace(next, await upsertContact({ ...previous, organization_id: orgId, is_primary: false }));
  return replace(next, await upsertContact({ ...target, organization_id: orgId, is_primary: true }));
}

export function OrgContacts({ orgId, contacts, canEdit, onChange }: OrgContactsProps) {
  const [draft, setDraft] = useState(BLANK);
  const [busy, setBusy] = useState(false);

  const saveField = (c: WsContact, key: Editable) => async (v: string | number | null) => {
    if (key === 'full_name' && !v) throw new Error('שם חובה');
    const row = await withFriendlyError(() => upsertContact({ ...c, organization_id: orgId, [key]: v }));
    onChange(replace(contacts, row));
  };

  const columns: readonly Column<WsContact>[] = useMemo(() => {
    const cell = (key: Editable, ltr = false) => (c: WsContact) => (
      <InlineEdit value={c[key]} disabled={!canEdit} ltr={ltr} onSave={saveField(c, key)} ariaLabel={key} />
    );
    return [
      { key: 'full_name', header: 'שם', render: cell('full_name') },
      { key: 'role_title', header: 'תפקיד', render: cell('role_title') },
      { key: 'email', header: 'אימייל', render: cell('email', true) },
      { key: 'phone', header: 'טלפון', render: cell('phone', true) },
      {
        key: 'primary', header: 'ראשי',
        render: (c) => c.is_primary ? <Pill label="ראשי" tone="teal" /> : canEdit ? (
          <button type="button" className="ghost sm" onClick={() => void promote(c)}>הגדרה כראשי</button>
        ) : null,
      },
      {
        key: 'del', header: '',
        render: (c) => canEdit ? (
          <span className={styles.rowActions}>
            <ConfirmButton label="מחיקה" small tone="danger" confirmText="למחוק איש קשר?"
              onConfirm={() => remove(c)} />
          </span>
        ) : null,
      },
    ];
  }, [contacts, canEdit]);

  async function promote(c: WsContact) {
    try {
      onChange(await makePrimary(orgId, contacts, c));
    } catch (err) {
      toast(dbErrorMessage(err));
    }
  }

  async function remove(c: WsContact) {
    await withFriendlyError(() => deleteContact(c.id));
    onChange(contacts.filter((x) => x.id !== c.id));
  }

  const add = async () => {
    setBusy(true);
    try {
      const row = await upsertContact({
        organization_id: orgId, full_name: draft.full_name.trim(), role_title: draft.role_title.trim() || null,
        email: draft.email.trim() || null, phone: draft.phone.trim() || null, is_primary: contacts.length === 0,
      });
      onChange([...contacts, row]);
      setDraft(BLANK);
    } catch (err) {
      toast(dbErrorMessage(err, 'הוספת איש הקשר נכשלה'));
    } finally {
      setBusy(false);
    }
  };

  const set = (k: keyof typeof BLANK) => (v: string) => setDraft((d) => ({ ...d, [k]: v }));
  return (
    <section className={`hud ${styles.card}`}>
      <div className={styles.cardHead}><h2>אנשי קשר</h2></div>
      <DataTable columns={columns} rows={contacts} rowKey={(c) => c.id} dense
        empty={<p className="hint">אין אנשי קשר. הוסיפו את הראשון בשורה למטה.</p>} />
      {canEdit ? (
        <div className={styles.assign}>
          <input type="text" placeholder="שם" value={draft.full_name} onChange={(e) => set('full_name')(e.target.value)} />
          <input type="text" placeholder="תפקיד" value={draft.role_title} onChange={(e) => set('role_title')(e.target.value)} />
          <input type="email" dir="ltr" placeholder="אימייל" value={draft.email} onChange={(e) => set('email')(e.target.value)} />
          <input type="text" dir="ltr" placeholder="טלפון" value={draft.phone} onChange={(e) => set('phone')(e.target.value)} />
          <button type="button" className="primary" disabled={busy || !draft.full_name.trim()} onClick={() => void add()}>
            הוספה
          </button>
        </div>
      ) : null}
    </section>
  );
}
