'use client';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Certificate01Icon } from '@hugeicons/core-free-icons';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { Spinner } from '@/components/ui/Spinner';
import { DataTable, type Column } from '@/components/ws/DataTable';
import { StatusPill } from '@/components/ws/StatusPill';
import { listAllCertificates, type CertificateWithWorkshop } from '@/components/ws/p5/api';
import { useLoad } from '@/components/ws/p5/useLoad';
import { filterCertificates } from '@/components/ws/p5/cert-search';
import styles from '@/components/ws/p5/p5.module.css';
import { formatDateHe } from '@/lib/ws/certificate-templates';

const COLUMNS: Column<CertificateWithWorkshop>[] = [
  { key: 'workshop', header: 'סדנה', sortValue: (c) => c.workshop?.title ?? '', render: (c) => (
    <Link href={`/workshops/${c.workshop_id}/certificates`}>{c.workshop?.title ?? c.workshop_id}</Link>
  ) },
  { key: 'name', header: 'נמען', sortValue: (c) => c.recipient_name, render: (c) => <span className="ink">{c.recipient_name}</span> },
  { key: 'no', header: 'מספר', sortValue: (c) => c.certificate_no, render: (c) => <span dir="ltr">{c.certificate_no}</span> },
  { key: 'status', header: 'סטטוס', render: (c) => <StatusPill kind="certificate" value={c.status} /> },
  { key: 'issued', header: 'הונפקה', sortValue: (c) => c.issued_at, render: (c) => formatDateHe(c.issued_at) },
];

export default function CertificatesPage() {
  const { data, error, loading } = useLoad(listAllCertificates, []);
  const [query, setQuery] = useState('');
  const rows = useMemo(() => filterCertificates(data ?? [], query), [data, query]);

  return (
    <>
      <PageHeader title="תעודות" subtitle="כל התעודות שהונפקו בסדנאות שלכם." />
      {loading && !data ? <div className={styles.center}><Spinner large /></div> : null}
      {error ? <p className="err" role="alert">{error}</p> : null}
      {data ? (
        <>
          <div className="toolbar">
            <input type="search" value={query} placeholder="חיפוש לפי נמען, מספר או סדנה" aria-label="חיפוש תעודות"
              onChange={(e) => setQuery(e.target.value)} />
            <span className="hint">{rows.length} תעודות</span>
          </div>
          <DataTable columns={COLUMNS} rows={rows} rowKey={(c) => c.id}
            empty={data.length === 0
              ? <EmptyState icon={Certificate01Icon} title="עדיין לא הונפקו תעודות"
                text="תעודות מונפקות מלשונית התעודות בתוך סדנה חיה או שהושלמה." />
              : <p className="hint">לא נמצאו תעודות לחיפוש הזה.</p>} />
        </>
      ) : null}
    </>
  );
}
