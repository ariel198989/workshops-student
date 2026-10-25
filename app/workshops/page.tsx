'use client';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Calendar01Icon } from '@hugeicons/core-free-icons';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { Spinner } from '@/components/ui/Spinner';
import { DataTable, type Column } from '@/components/ws/DataTable';
import { StatusPill } from '@/components/ws/StatusPill';
import { FORMAT_LABELS, FORMAT_OPTIONS } from '@/components/ws/p3/options';
import styles from '@/components/ws/p3/p3.module.css';
import { fmtDay, sortWorkshops, statusRank } from '@/components/ws/p3/workshop-utils';
import { toast, useStore } from '@/lib/store';
import { labelOf } from '@/lib/ws/labels';
import { listOrganizations } from '@/lib/ws/orgs';
import { isAdmin, wsAuthStore } from '@/lib/ws/staff';
import { WORKSHOP_STATUSES, type WorkshopFormat, type WorkshopStatus, type WsOrganization } from '@/lib/ws/types';
import { listWorkshops, type WorkshopWithOrg } from '@/lib/ws/workshops';

interface Filters { org: string; format: WorkshopFormat | ''; status: WorkshopStatus | '' }
const NO_FILTERS: Filters = { org: '', format: '', status: '' };

const COLUMNS: readonly Column<WorkshopWithOrg>[] = [
  { key: 'title', header: 'סדנה', sortValue: (w) => w.title, render: (w) => <span className="ink">{w.title}</span> },
  { key: 'code', header: 'קוד', sortValue: (w) => w.code, render: (w) => <span className={styles.code}>{w.code}</span> },
  { key: 'org', header: 'ארגון', sortValue: (w) => w.organization?.name, render: (w) => w.organization?.name ?? '' },
  { key: 'format', header: 'פורמט', sortValue: (w) => w.format, render: (w) => FORMAT_LABELS[w.format] },
  { key: 'status', header: 'סטטוס', sortValue: (w) => statusRank(w.status), render: (w) => <StatusPill kind="workshop" value={w.status} /> },
  { key: 'starts', header: 'התחלה', sortValue: (w) => w.starts_on, render: (w) => fmtDay(w.starts_on) },
  { key: 'class', header: 'כיתה', render: (w) => [w.grade_level, w.class_label].filter(Boolean).join(' ') },
  { key: 'size', header: 'משתתפים', num: true, sortValue: (w) => w.audience_size, render: (w) => w.audience_size ?? '' },
];

export default function Page() {
  const router = useRouter();
  const admin = isAdmin(useStore(wsAuthStore).whoami);
  const [rows, setRows] = useState<WorkshopWithOrg[] | null>(null);
  const [orgs, setOrgs] = useState<WsOrganization[]>([]);
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);

  useEffect(() => {
    let live = true;
    listWorkshops()
      .then((data) => { if (live) setRows(sortWorkshops(data)); })
      .catch(() => { if (live) { setRows([]); toast('טעינת הסדנאות נכשלה'); } });
    listOrganizations().then((data) => { if (live) setOrgs(data); }).catch(() => undefined);
    return () => { live = false; };
  }, []);

  const visible = useMemo(() => (rows ?? []).filter((w) =>
    (!filters.org || w.organization_id === filters.org)
    && (!filters.format || w.format === filters.format)
    && (!filters.status || w.status === filters.status)), [rows, filters]);

  const newButton = admin
    ? <button type="button" className="primary" onClick={() => router.push('/workshops/new')}>סדנה חדשה</button>
    : null;
  const filtered = !!(filters.org || filters.format || filters.status);
  const set = <K extends keyof Filters>(k: K, v: Filters[K]) => setFilters((f) => ({ ...f, [k]: v }));

  const empty = filtered
    ? <EmptyState icon={Calendar01Icon} title="אין סדנאות שמתאימות לסינון"
      actions={<button type="button" onClick={() => setFilters(NO_FILTERS)}>ניקוי הסינון</button>} />
    : <EmptyState icon={Calendar01Icon} title="אין סדנאות" actions={newButton} />;

  return (
    <>
      <PageHeader title="סדנאות" subtitle="ניהול סדנאות, מועדים, קבוצות ומשתתפים." actions={newButton} />
      <div className={`toolbar ${styles.filters}`}>
        <select value={filters.org} aria-label="סינון לפי ארגון" onChange={(e) => set('org', e.target.value)}>
          <option value="">כל הארגונים</option>
          {orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
        </select>
        <select value={filters.format} aria-label="סינון לפי פורמט" onChange={(e) => set('format', e.target.value as Filters['format'])}>
          <option value="">כל הפורמטים</option>
          {FORMAT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <select value={filters.status} aria-label="סינון לפי סטטוס" onChange={(e) => set('status', e.target.value as Filters['status'])}>
          <option value="">כל הסטטוסים</option>
          {WORKSHOP_STATUSES.map((s) => <option key={s} value={s}>{labelOf('workshop', s)}</option>)}
        </select>
      </div>
      {rows === null ? <Spinner large /> : (
        <DataTable columns={COLUMNS} rows={visible} rowKey={(w) => w.id} dense empty={empty}
          onRowClick={(w) => router.push(`/workshops/${w.id}/overview`)} />
      )}
    </>
  );
}
