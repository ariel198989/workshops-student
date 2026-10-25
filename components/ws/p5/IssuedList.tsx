'use client';
import { DataTable, type Column } from '../DataTable';
import { StatusPill } from '../StatusPill';
import { CERTIFICATE_VARIANT_LIST, VARIANT_LABELS, buildVerifyUrl } from '@/lib/ws/certificate-templates';
import type { CertificateVariant } from '@/lib/ws/certificates';
import { toast } from '@/lib/store';
import type { WsCertificate } from '@/lib/ws/types';
import { RevokeControl } from './RevokeControl';
import styles from './p5.module.css';

interface IssuedListProps {
  certificates: readonly WsCertificate[];
  variants: Readonly<Record<string, CertificateVariant>>;
  /** variants the system suggests (distinction from a demo score of 85) */
  suggested: Readonly<Record<string, CertificateVariant>>;
  admin: boolean;
  onVariant: (id: string, variant: CertificateVariant) => void;
  onPreview: (cert: WsCertificate) => void;
  onPrint: (cert: WsCertificate) => void;
  onRevoked: () => void;
}

const isVariant = (v: string): v is CertificateVariant => (CERTIFICATE_VARIANT_LIST as readonly string[]).includes(v);

async function copyLink(code: string) {
  try {
    await navigator.clipboard.writeText(buildVerifyUrl(window.location.origin, code));
    toast('הקישור הועתק', true);
  } catch {
    toast('ההעתקה נכשלה, העתיקו ידנית מתצוגת התעודה');
  }
}

export function IssuedList({ certificates, variants, suggested, admin, onVariant, onPreview, onPrint, onRevoked }: IssuedListProps) {
  const columns: Column<WsCertificate>[] = [
    { key: 'no', header: 'מספר', sortValue: (c) => c.certificate_no, render: (c) => <span dir="ltr">{c.certificate_no}</span> },
    { key: 'name', header: 'נמען', sortValue: (c) => c.recipient_name, render: (c) => <span className="ink">{c.recipient_name}</span> },
    { key: 'group', header: 'קבוצה', render: (c) => c.group_name ?? '-' },
    { key: 'variant', header: 'נוסח', render: (c) => (
      <span className={styles.metaRow}>
        <select value={variants[c.id]} aria-label="נוסח התעודה" disabled={c.status === 'revoked'}
          onChange={(e) => { if (isVariant(e.target.value)) onVariant(c.id, e.target.value); }}>
          {CERTIFICATE_VARIANT_LIST.map((v) => <option key={v} value={v}>{VARIANT_LABELS[v]}</option>)}
        </select>
        {suggested[c.id] === 'distinction' && variants[c.id] !== 'distinction' ? <span className="hint">מומלץ: הצטיינות</span> : null}
      </span>
    ) },
    { key: 'status', header: 'סטטוס', render: (c) => <StatusPill kind="certificate" value={c.status} /> },
    { key: 'actions', header: '', render: (c) => (
      <span className="row">
        <button type="button" className="sm" onClick={() => onPreview(c)}>תצוגה</button>
        <button type="button" className="sm" disabled={c.status === 'revoked'} onClick={() => onPrint(c)}>הדפסה</button>
        <button type="button" className="sm" onClick={() => void copyLink(c.verify_code)}>העתקת קישור אימות</button>
        {admin && c.status === 'issued' ? <RevokeControl certificateId={c.id} onRevoked={onRevoked} /> : null}
      </span>
    ) },
  ];
  return (
    <DataTable columns={columns} rows={certificates} rowKey={(c) => c.id}
      empty={<p className="hint">עדיין לא הונפקו תעודות.</p>} />
  );
}
