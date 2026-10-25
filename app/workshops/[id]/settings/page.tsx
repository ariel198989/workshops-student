'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Settings02Icon } from '@hugeicons/core-free-icons';
import { EmptyState } from '@/components/ui/EmptyState';
import { Spinner } from '@/components/ui/Spinner';
import { CustomFieldsCard } from '@/components/ws/p3/CustomFieldsCard';
import { withFriendlyError } from '@/components/ws/p3/db-errors';
import { WorkshopFields } from '@/components/ws/p3/WorkshopFields';
import { WorkshopStaffPanel } from '@/components/ws/p3/WorkshopStaffPanel';
import { useStore } from '@/lib/store';
import { listGroups } from '@/lib/ws/groups';
import { canEdit, isAdmin, wsAuthStore } from '@/lib/ws/staff';
import type { WsWorkshop } from '@/lib/ws/types';
import { getWorkshop, updateWorkshop } from '@/lib/ws/workshops';

export default function Page() {
  const { id } = useParams<{ id: string }>();
  const { whoami } = useStore(wsAuthStore);
  const admin = isAdmin(whoami);
  const editable = canEdit(whoami, id);
  const [workshop, setWorkshop] = useState<WsWorkshop | null | undefined>(undefined);
  // null until the groups check returns: identity stays locked meanwhile
  const [activated, setActivated] = useState<boolean | null>(null);

  useEffect(() => {
    let live = true;
    getWorkshop(id).then((w) => { if (live) setWorkshop(w); }).catch(() => { if (live) setWorkshop(null); });
    // team_prefix / code key Smart City data once any group has an sc_class
    listGroups(id).then((gs) => { if (live) setActivated(gs.some((g) => g.sc_class_id !== null)); }).catch(() => undefined);
    return () => { live = false; };
  }, [id]);

  if (workshop === undefined) return <Spinner large />;
  if (workshop === null) return <EmptyState icon={Settings02Icon} title="ההגדרות לא נטענו" text="רעננו את הדף ונסו שוב." />;

  return (
    <>
      <WorkshopFields workshop={workshop} canEdit={editable} identityLocked={activated !== false || !admin} onSaved={setWorkshop} />
      <WorkshopStaffPanel workshopId={id} admin={admin} />
      <CustomFieldsCard entity="workshop" organizationId={workshop.organization_id} value={workshop.custom_fields}
        disabled={!editable}
        onSave={async (custom_fields) => setWorkshop(await withFriendlyError(() => updateWorkshop(id, { custom_fields })))} />
    </>
  );
}
