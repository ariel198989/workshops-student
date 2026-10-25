'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Building02Icon } from '@hugeicons/core-free-icons';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { Spinner } from '@/components/ui/Spinner';
import { DataTable, type Column } from '@/components/ws/DataTable';
import { Pill, StatusPill } from '@/components/ws/StatusPill';
import { OrgCreateRow } from '@/components/ws/p3/OrgCreateRow';
import { ORG_KIND_LABELS, ORG_STATUS_OPTIONS } from '@/components/ws/p3/options';
import styles from '@/components/ws/p3/p3.module.css';
import { toast, useStore } from '@/lib/store';
import { listOrganizations } from '@/lib/ws/orgs';
import { isAdmin, wsAuthStore } from '@/lib/ws/staff';
import type { OrgStatus, WsOrganization } from '@/lib/ws/types';
import { listWorkshops } from '@/lib/ws/workshops';

type StatusFilter = OrgStatus | '';

export default function Page() {
  const router = useRouter();
  const admin = isAdmin(useStore(wsAuthStore).whoami);
  const [orgs, setOrgs] = useState<WsOrganization[] | null>(null);
  const [counts, setCounts] = useState<ReadonlyMap<string, number>>(new Map());
  const [status, setStatus] = useState<StatusFilter>('');
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    try {
      const [list, workshops] = await Promise.all([listOrganizations(), listWorkshops()]);
      const next = new Map<string, number>();
      for (const w of workshops) next.set(w.organization_id, (next.get(w.organization_id) ?? 0) + 1);
      setCounts(next);
      setOrgs(list);
    } catch {
      setOrgs([]);
      toast('טעינת הארגונים נכשלה');
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const visible = useMemo(() => (orgs ?? []).filter((o) => !status || o.status === status), [orgs, status]);

  const columns: readonly Column<WsOrganization>[] = useMemo(() => [
    { key: 'name', header: 'שם', sortValue: (o) => o.name, render: (o) => <span className="ink">{o.name}</span> },
    { key: 'kind', header: 'סוג', sortValue: (o) => o.kind, render: (o) => <Pill label={ORG_KIND_LABELS[o.kind]} tone="gray" /> },
    { key: 'city', header: 'עיר', sortValue: (o) => o.city, render: (o) => o.city ?? '' },
    { key: 'status', header: 'סטטוס', sortValue: (o) => o.status, render: (o) => <StatusPill kind="org" value={o.status} /> },
    { key: 'workshops', header: 'סדנאות', num: true, sortValue: (o) => counts.get(o.id) ?? 0, render: (o) => counts.get(o.id) ?? 0 },
  ], [counts]);

  const newButton = admin && !adding
    ? <button type="button" className="primary" onClick={() => setAdding(true)}>+ ארגון חדש</button>
    : null;

  const empty = orgs !== null && orgs.length === 0
    ? <EmptyState icon={Building02Icon} title="עדיין אין ארגונים" actions={newButton} />
    : <EmptyState icon={Building02Icon} title="אין ארגונים בסטטוס הזה" actions={
      <button type="button" onClick={() => setStatus('')}>הצגת הכל</button>} />;

  return (
    <>
      <PageHeader title="ארגונים" subtitle="בתי ספר, רשויות וארגונים שמקבלים סדנאות." actions={newButton} />
      {adding ? (
        <OrgCreateRow onCancel={() => setAdding(false)}
          onCreated={(org) => { setAdding(false); router.push(`/orgs/${org.id}`); }} />
      ) : null}
      <div className={`toolbar ${styles.filters}`}>
        <select value={status} aria-label="סינון לפי סטטוס" onChange={(e) => setStatus(e.target.value as StatusFilter)}>
          <option value="">כל הסטטוסים</option>
          {ORG_STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>
      {orgs === null ? <Spinner large /> : (
        <DataTable columns={columns} rows={visible} rowKey={(o) => o.id} dense empty={empty}
          onRowClick={(o) => router.push(`/orgs/${o.id}`)} />
      )}
    </>
  );
}
