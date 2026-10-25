'use client';
import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Building02Icon } from '@hugeicons/core-free-icons';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { Spinner } from '@/components/ui/Spinner';
import { ConfirmButton } from '@/components/ws/ConfirmButton';
import { StatusPill } from '@/components/ws/StatusPill';
import { CustomFieldsCard } from '@/components/ws/p3/CustomFieldsCard';
import { withFriendlyError } from '@/components/ws/p3/db-errors';
import { OrgContacts } from '@/components/ws/p3/OrgContacts';
import { OrgDetails } from '@/components/ws/p3/OrgDetails';
import { OrgWorkshops } from '@/components/ws/p3/OrgWorkshops';
import { toast, useStore } from '@/lib/store';
import { getOrganization, updateOrganization, type OrgWithContacts } from '@/lib/ws/orgs';
import { isAdmin, wsAuthStore } from '@/lib/ws/staff';
import type { WsContact, WsOrganization, WsWorkshop } from '@/lib/ws/types';
import { listWorkshops } from '@/lib/ws/workshops';

const byCreated = (a: WsContact, b: WsContact): number => a.created_at.localeCompare(b.created_at);

export default function Page() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const admin = isAdmin(useStore(wsAuthStore).whoami);
  const [org, setOrg] = useState<OrgWithContacts | null | undefined>(undefined);
  const [workshops, setWorkshops] = useState<WsWorkshop[]>([]);

  useEffect(() => {
    let live = true;
    Promise.all([getOrganization(id), listWorkshops({ organizationId: id })])
      .then(([o, w]) => {
        if (!live) return;
        setOrg({ ...o, contacts: [...o.contacts].sort(byCreated) });
        setWorkshops(w);
      })
      .catch(() => { if (live) setOrg(null); });
    return () => { live = false; };
  }, [id]);

  const merge = useCallback((next: WsOrganization) => {
    setOrg((prev) => (prev ? { ...prev, ...next } : prev));
  }, []);

  if (org === undefined) return <Spinner large />;
  if (org === null) {
    return (
      <EmptyState icon={Building02Icon} title="הארגון לא נמצא"
        actions={<button type="button" className="primary" onClick={() => router.push('/orgs')}>חזרה לארגונים</button>} />
    );
  }

  const archived = org.status === 'archived';
  const setStatus = (status: WsOrganization['status']) => async () => {
    merge(await withFriendlyError(() => updateOrganization(org.id, { status })));
    toast(status === 'archived' ? 'הארגון הועבר לארכיון' : 'הארגון שוחזר', true);
  };

  return (
    <>
      <PageHeader title={org.name} subtitle={org.city ?? undefined} actions={
        <>
          <StatusPill kind="org" value={org.status} />
          {admin ? (archived
            ? <ConfirmButton label="שחזור" confirmText="לשחזר את הארגון?" onConfirm={setStatus('active')} />
            : <ConfirmButton label="העברה לארכיון" tone="danger" confirmText="להעביר לארכיון?" onConfirm={setStatus('archived')} />
          ) : null}
        </>
      } />
      <OrgDetails org={org} canEdit={admin} onSaved={merge} />
      <OrgContacts orgId={org.id} contacts={org.contacts} canEdit={admin}
        onChange={(contacts) => setOrg((prev) => (prev ? { ...prev, contacts } : prev))} />
      <CustomFieldsCard entity="organization" organizationId={org.id} value={org.custom_fields} disabled={!admin}
        onSave={async (custom_fields) => merge(await withFriendlyError(() => updateOrganization(org.id, { custom_fields })))} />
      <OrgWorkshops orgId={org.id} workshops={workshops} canCreate={admin} />
    </>
  );
}
