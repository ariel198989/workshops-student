'use client';
import { useMemo, useState } from 'react';
import { InlineEdit, type InlineOption } from '@/components/ws/InlineEdit';
import { ConfirmButton } from '@/components/ws/ConfirmButton';
import { DataTable, type Column } from '@/components/ws/DataTable';
import { StatusPill } from '@/components/ws/StatusPill';
import { toast } from '@/lib/store';
import { listGroups } from '@/lib/ws/groups';
import {
  listParticipants, moveParticipant, updateParticipant, type ParticipantWithGroup,
} from '@/lib/ws/participants';
import type { ParticipantPatch, WsGroup } from '@/lib/ws/types';
import { LinkPicker } from '@/components/ws/p4/LinkPicker';
import { LoadGate } from '@/components/ws/p4/LoadGate';
import { RosterPaste } from '@/components/ws/p4/RosterPaste';
import { linkCandidates } from '@/components/ws/p4/link-utils';
import { errorText, useCanEdit, useLoader, useWorkshopId } from '@/components/ws/p4/hooks';
import styles from '@/components/ws/p4/people.module.css';

interface Data { rows: ParticipantWithGroup[]; groups: WsGroup[] }

const SOURCE_LABELS = { roster: 'רשימה', signup: 'הרשמה באפליקציה', manual: 'ידני' } as const;
const CONSENT_OPTIONS: readonly InlineOption[] = [
  { value: 'true', label: 'אושרה' },
  { value: 'false', label: 'לא אושרה' },
];
const text = (v: string | number | null): string | null => (v === null || v === '' ? null : String(v));
const groupLabel = (g: WsGroup): string => `קבוצה ${g.number}${g.display_name ? `: ${g.display_name}` : ''}`;

export default function ParticipantsPage() {
  const id = useWorkshopId();
  const canEdit = useCanEdit(id);
  const { data, error, loading, reload, setData } = useLoader<Data>(
    async () => {
      const [rows, groups] = await Promise.all([listParticipants(id), listGroups(id)]);
      return { rows, groups };
    }, id);
  const [query, setQuery] = useState('');
  const [showWithdrawn, setShowWithdrawn] = useState(false);
  const [linkBase, setLinkBase] = useState<ParticipantWithGroup | null>(null);

  const rows = data?.rows ?? [];
  const groups = data?.groups ?? [];
  const groupOptions = useMemo<InlineOption[]>(() => groups.map((g) => ({ value: g.id, label: groupLabel(g) })), [groups]);
  const existingNames = useMemo(() => new Set(rows.map((r) => r.full_name.toLowerCase())), [rows]);
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => (showWithdrawn || r.status !== 'withdrawn') && (!q || r.full_name.toLowerCase().includes(q)));
  }, [rows, query, showWithdrawn]);

  const patchLocal = (pid: string, change: Partial<ParticipantWithGroup>) =>
    setData((cur) => cur && { ...cur, rows: cur.rows.map((r) => (r.id === pid ? { ...r, ...change } : r)) });

  const save = async (pid: string, patch: ParticipantPatch) => {
    const saved = await updateParticipant(pid, patch);
    patchLocal(pid, { ...patch, updated_at: saved.updated_at });
  };

  const restore = async (pid: string) => {
    try {
      await save(pid, { status: 'active' });
    } catch (err) {
      toast(errorText(err, 'ההחזרה נכשלה'));
    }
  };

  const move = async (pid: string, groupId: string | null) => {
    await moveParticipant(pid, groupId);
    const g = groups.find((x) => x.id === groupId);
    patchLocal(pid, { group_id: groupId, group: g ? { number: g.number, display_name: g.display_name } : null });
  };

  const columns: Column<ParticipantWithGroup>[] = [
    { key: 'name', header: 'שם', sortValue: (r) => r.full_name,
      render: (r) => <InlineEdit value={r.full_name} disabled={!canEdit} ariaLabel="שם" onSave={(v) => text(v) ? save(r.id, { full_name: text(v) ?? r.full_name }) : undefined} /> },
    { key: 'grade', header: 'כיתה', width: '90px',
      render: (r) => <InlineEdit value={r.grade} disabled={!canEdit} ariaLabel="כיתה" onSave={(v) => save(r.id, { grade: text(v) })} /> },
    { key: 'group', header: 'קבוצה', sortValue: (r) => r.group?.number,
      render: (r) => (
        <InlineEdit type="select" value={r.group_id} options={groupOptions} disabled={!canEdit} placeholder="ללא קבוצה" ariaLabel="קבוצה"
          onSave={(v) => move(r.id, text(v))} />
      ) },
    { key: 'account', header: 'חשבון',
      render: (r) => r.user_id ? <span className={styles.tick} title="מחובר לאפליקציה">✓</span> : (
        canEdit && linkCandidates(r, rows).length > 0
          ? <button type="button" className="sm" onClick={() => setLinkBase(r)}>זה אותו תלמיד?</button>
          : <span className="muted">-</span>
      ) },
    { key: 'source', header: 'מקור', sortValue: (r) => r.source, render: (r) => SOURCE_LABELS[r.source] },
    { key: 'consent', header: 'הסכמת צילום',
      render: (r) => (
        <InlineEdit type="select" value={r.media_consent === null ? null : String(r.media_consent)} options={CONSENT_OPTIONS}
          disabled={!canEdit} placeholder="לא נבדק" ariaLabel="הסכמת צילום"
          onSave={(v) => save(r.id, { media_consent: v === null ? null : v === 'true' })} />
      ) },
    { key: 'status', header: 'סטטוס', sortValue: (r) => r.status, render: (r) => <StatusPill kind="participant" value={r.status} /> },
    { key: 'notes', header: 'הערות',
      render: (r) => <InlineEdit value={r.notes} disabled={!canEdit} ariaLabel="הערות" onSave={(v) => save(r.id, { notes: text(v) })} /> },
    { key: 'actions', header: '', width: '110px',
      render: (r) => !canEdit ? null : (
        <span className={styles.rowActions}>
          {r.status === 'withdrawn'
            ? <button type="button" className="sm" onClick={() => void restore(r.id)}>החזר</button>
            : <ConfirmButton label="פרישה" confirmText="לסמן כפורש?" tone="danger" small onConfirm={() => save(r.id, { status: 'withdrawn' })} />}
        </span>
      ) },
  ];

  const linked = rows.filter((r) => r.user_id && r.status !== 'withdrawn').length;
  const activeCount = rows.filter((r) => r.status !== 'withdrawn').length;
  return (
    <LoadGate loading={loading} error={error} hasData={!!data} onRetry={() => void reload()}>
      <div className={styles.bar}>
        <div>
          <h2>משתתפים</h2>
          <span className={styles.summary}>{activeCount} פעילים, {linked} מחוברים לאפליקציה</span>
        </div>
        <div className={styles.tools}>
          <input type="search" placeholder="חיפוש לפי שם" aria-label="חיפוש לפי שם" value={query} onChange={(e) => setQuery(e.target.value)} />
          <label className={styles.check}>
            <input type="checkbox" checked={showWithdrawn} onChange={(e) => setShowWithdrawn(e.target.checked)} />
            הצג פורשים
          </label>
        </div>
      </div>

      {canEdit ? <RosterPaste workshopId={id} existing={existingNames} onAdded={() => void reload()} /> : null}

      <DataTable columns={columns} rows={visible} rowKey={(r) => r.id} dense
        empty={<p className="hud muted" style={{ padding: 24, textAlign: 'center' }}>
          {rows.length === 0 ? 'אין משתתפים עדיין. הדביקו רשימה, או חכו שתלמידים יירשמו באפליקציה אחרי הפעלת הקבוצות.' : 'אין תוצאות.'}
        </p>} />

      <LinkPicker base={linkBase} rows={rows} onClose={() => setLinkBase(null)} onLinked={() => void reload()} />
    </LoadGate>
  );
}
