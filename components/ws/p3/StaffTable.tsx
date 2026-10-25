'use client';
import { useMemo } from 'react';
import { UserMultiple02Icon } from '@hugeicons/core-free-icons';
import { EmptyState } from '@/components/ui/EmptyState';
import { toast } from '@/lib/store';
import { STAFF_ROLE_PILLS } from '@/lib/ws/labels';
import { setStaffActive, updateStaffRole } from '@/lib/ws/staff';
import { STAFF_ROLES, type StaffRole, type WsStaff } from '@/lib/ws/types';
import { ConfirmButton } from '../ConfirmButton';
import { DataTable, type Column } from '../DataTable';
import { InlineEdit } from '../InlineEdit';
import { Pill } from '../StatusPill';
import { withFriendlyError } from './db-errors';
import { STAFF_ROLE_LABELS } from './options';
import { staffPolicy } from './staff-utils';
import styles from './p3.module.css';

interface StaffTableProps {
  rows: readonly WsStaff[];
  viewerRole: StaffRole | null;
  viewerId: string | null;
  onChanged: (row: WsStaff) => void;
}

export function StaffTable({ rows, viewerRole, viewerId, onChanged }: StaffTableProps) {
  const columns: readonly Column<WsStaff>[] = useMemo(() => [
    { key: 'name', header: 'שם', sortValue: (s) => s.full_name, render: (s) => <span className="ink">{s.full_name || '-'}</span> },
    { key: 'email', header: 'אימייל', sortValue: (s) => s.email, render: (s) => <span dir="ltr">{s.email}</span> },
    {
      key: 'role', header: 'תפקיד', sortValue: (s) => STAFF_ROLES.indexOf(s.role),
      render: (s) => {
        const policy = staffPolicy(viewerRole, viewerId, s);
        if (!policy.canChangeRole) return <Pill {...STAFF_ROLE_PILLS[s.role]} />;
        return (
          <InlineEdit type="select" value={s.role} ariaLabel="תפקיד"
            options={policy.roleOptions.map((r) => ({ value: r, label: STAFF_ROLE_LABELS[r] }))}
            display={() => <Pill {...STAFF_ROLE_PILLS[s.role]} />}
            onSave={async (v) => {
              if (!v) throw new Error('תפקיד חובה');
              onChanged(await withFriendlyError(() => updateStaffRole(s.user_id, v as StaffRole)));
            }} />
        );
      },
    },
    {
      key: 'active', header: 'מצב', sortValue: (s) => (s.active ? 0 : 1),
      render: (s) => <Pill label={s.active ? 'פעיל' : 'מושבת'} tone={s.active ? 'green' : 'outline'} />,
    },
    {
      key: 'actions', header: '',
      render: (s) => {
        if (!staffPolicy(viewerRole, viewerId, s).canToggleActive) return null;
        const next = !s.active;
        return (
          <span className={styles.rowActions}>
            <ConfirmButton small tone={next ? 'default' : 'danger'} label={next ? 'הפעלה מחדש' : 'השבתה'}
              confirmText={next ? 'להפעיל מחדש?' : 'להשבית את איש הצוות?'}
              onConfirm={async () => {
                onChanged(await withFriendlyError(() => setStaffActive(s.user_id, next)));
                toast(next ? 'איש הצוות הופעל' : 'איש הצוות הושבת', true);
              }} />
          </span>
        );
      },
    },
  ], [viewerRole, viewerId, onChanged]);

  return (
    <DataTable columns={columns} rows={rows} rowKey={(s) => s.user_id} dense
      empty={<EmptyState icon={UserMultiple02Icon} title="אין אנשי צוות" text="הוסיפו את הראשון בשורה למעלה." />} />
  );
}
