'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from '@/lib/store';
import { listStaff } from '@/lib/ws/staff';
import { WORKSHOP_ROLES, type WorkshopRole, type WsStaff } from '@/lib/ws/types';
import {
  assignStaff, listWorkshopStaff, unassignStaff, type WorkshopStaffRow,
} from '@/lib/ws/workshops';
import { ConfirmButton } from '../ConfirmButton';
import { DataTable, type Column } from '../DataTable';
import { InlineEdit } from '../InlineEdit';
import { dbErrorMessage, withFriendlyError } from './db-errors';
import { WORKSHOP_ROLE_LABELS, WORKSHOP_ROLE_OPTIONS } from './options';
import styles from './p3.module.css';

interface WorkshopStaffPanelProps {
  workshopId: string;
  /** ws_workshop_staff writes are admin-only (RLS) */
  admin: boolean;
}

export function WorkshopStaffPanel({ workshopId, admin }: WorkshopStaffPanelProps) {
  const [rows, setRows] = useState<WorkshopStaffRow[] | null>(null);
  const [staff, setStaff] = useState<WsStaff[]>([]);
  const [pick, setPick] = useState('');
  const [role, setRole] = useState<WorkshopRole>('instructor');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setRows(await listWorkshopStaff(workshopId));
    } catch {
      setRows([]);
      toast('טעינת צוות הסדנה נכשלה');
    }
  }, [workshopId]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (admin) listStaff().then(setStaff).catch(() => undefined);
  }, [admin]);

  const available = useMemo(() => {
    const taken = new Set((rows ?? []).map((r) => r.user_id));
    return staff.filter((s) => s.active && !taken.has(s.user_id));
  }, [rows, staff]);

  const add = async () => {
    setBusy(true);
    try {
      await assignStaff(workshopId, pick, role);
      setPick('');
      await load();
    } catch (err) {
      toast(dbErrorMessage(err, 'השיוך נכשל'));
    } finally {
      setBusy(false);
    }
  };

  const columns: readonly Column<WorkshopStaffRow>[] = [
    { key: 'name', header: 'שם', render: (r) => <span className="ink">{r.staff?.full_name || r.staff?.email}</span> },
    { key: 'email', header: 'אימייל', render: (r) => <span dir="ltr">{r.staff?.email}</span> },
    {
      key: 'role', header: 'תפקיד בסדנה',
      render: (r) => (
        <InlineEdit type="select" value={r.role} options={WORKSHOP_ROLE_OPTIONS} disabled={!admin}
          onSave={async (v) => {
            await withFriendlyError(() => assignStaff(workshopId, r.user_id, v as WorkshopRole));
            await load();
          }} />
      ),
    },
    {
      key: 'rm', header: '',
      render: (r) => admin ? (
        <span className={styles.rowActions}>
          <ConfirmButton label="הסרה" small tone="danger" confirmText="להסיר מהסדנה?"
            onConfirm={async () => { await withFriendlyError(() => unassignStaff(workshopId, r.user_id)); await load(); }} />
        </span>
      ) : null,
    },
  ];

  return (
    <section className={`hud ${styles.card}`}>
      <div className={styles.cardHead}><h2>צוות הסדנה</h2></div>
      <DataTable columns={columns} rows={rows ?? []} rowKey={(r) => r.user_id} dense
        empty={<p className="hint">{rows === null ? 'טוען...' : 'אין צוות משויך לסדנה.'}</p>} />
      {admin ? (
        <div className={styles.assign}>
          <select value={pick} aria-label="איש צוות" onChange={(e) => setPick(e.target.value)}>
            <option value="">בחירת איש צוות</option>
            {available.map((s) => <option key={s.user_id} value={s.user_id}>{s.full_name || s.email}</option>)}
          </select>
          <select value={role} aria-label="תפקיד בסדנה" onChange={(e) => setRole(e.target.value as WorkshopRole)}>
            {WORKSHOP_ROLES.map((r) => <option key={r} value={r}>{WORKSHOP_ROLE_LABELS[r]}</option>)}
          </select>
          <button type="button" className="primary" disabled={busy || !pick} onClick={() => void add()}>שיוך</button>
        </div>
      ) : null}
    </section>
  );
}
