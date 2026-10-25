'use client';
import { useEffect, useState } from 'react';
import { LockIcon, Settings02Icon } from '@hugeicons/core-free-icons';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { Spinner } from '@/components/ui/Spinner';
import { FieldDefAddRow } from '@/components/ws/p3/FieldDefAddRow';
import { FieldDefsTable } from '@/components/ws/p3/FieldDefsTable';
import { ENTITY_OPTIONS } from '@/components/ws/p3/options';
import styles from '@/components/ws/p3/p3.module.css';
import { toast, useStore } from '@/lib/store';
import { listFieldDefinitions, listOrganizations } from '@/lib/ws/orgs';
import { isAdmin, wsAuthStore } from '@/lib/ws/staff';
import type { FieldEntity, WsFieldDefinition, WsOrganization } from '@/lib/ws/types';

export default function Page() {
  const { whoami, loaded } = useStore(wsAuthStore);
  const admin = isAdmin(whoami);
  const [entity, setEntity] = useState<FieldEntity>('organization');
  const [orgId, setOrgId] = useState('');
  const [orgs, setOrgs] = useState<WsOrganization[]>([]);
  const [defs, setDefs] = useState<WsFieldDefinition[] | null>(null);

  useEffect(() => {
    if (admin) listOrganizations().then(setOrgs).catch(() => undefined);
  }, [admin]);

  useEffect(() => {
    if (!admin) return;
    let live = true;
    setDefs(null);
    listFieldDefinitions(entity, orgId || undefined)
      .then((rows) => { if (live) setDefs(rows); })
      .catch(() => { if (live) { setDefs([]); toast('טעינת השדות נכשלה'); } });
    return () => { live = false; };
  }, [admin, entity, orgId]);

  if (!loaded) return <Spinner large />;
  if (!admin) {
    return <EmptyState icon={LockIcon} title="הדף זמין למנהלים בלבד" text="פנו לבעלים או למנהל כדי להגדיר שדות מותאמים." />;
  }

  const nextPosition = (defs ?? []).reduce((max, d) => Math.max(max, d.position), 0) + 1;
  return (
    <>
      <PageHeader title="הגדרות" subtitle="שדות מותאמים לארגונים, סדנאות, קבוצות ומשתתפים." />
      <div className={styles.scopeBar}>
        <div className={styles.seg} role="tablist" aria-label="סוג רשומה">
          {ENTITY_OPTIONS.map((o) => (
            <button key={o.value} type="button" role="tab" aria-selected={entity === o.value}
              className={entity === o.value ? styles.segOn : undefined} onClick={() => setEntity(o.value as FieldEntity)}>
              {o.label}
            </button>
          ))}
        </div>
        <select value={orgId} aria-label="היקף" style={{ width: 'auto', minWidth: 170 }} onChange={(e) => setOrgId(e.target.value)}>
          <option value="">גלובלי (כל הארגונים)</option>
          {orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
        </select>
      </div>
      <FieldDefAddRow entity={entity} organizationId={orgId || null} nextPosition={nextPosition}
        onAdded={(d) => setDefs((prev) => [...(prev ?? []), d])} />
      {defs === null ? <Spinner large /> : (
        <FieldDefsTable defs={defs} onChanged={setDefs}
          empty={<EmptyState icon={Settings02Icon} title="אין שדות מותאמים" text="הוסיפו את הראשון בשורה למעלה." />} />
      )}
    </>
  );
}
