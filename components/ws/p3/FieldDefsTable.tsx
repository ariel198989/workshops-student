'use client';
import { useMemo, type ReactNode } from 'react';
import { toast } from '@/lib/store';
import { archiveFieldDefinition, saveFieldDefinition } from '@/lib/ws/orgs';
import type { FieldType, WsFieldDefinition } from '@/lib/ws/types';
import { ConfirmButton } from '../ConfirmButton';
import { DataTable, type Column } from '../DataTable';
import { InlineEdit } from '../InlineEdit';
import { Pill } from '../StatusPill';
import { withFriendlyError } from './db-errors';
import { needsOptions, optionsToText, parseOptions } from './fielddef-utils';
import { FIELD_TYPE_OPTIONS } from './options';
import styles from './p3.module.css';

interface FieldDefsTableProps {
  defs: readonly WsFieldDefinition[];
  empty: ReactNode;
  onChanged: (next: WsFieldDefinition[]) => void;
}

export function FieldDefsTable({ defs, empty, onChanged }: FieldDefsTableProps) {
  const columns: readonly Column<WsFieldDefinition>[] = useMemo(() => {
    // upsert needs the full row (NOT NULL columns), so merge the patch into the current definition
    const patch = (d: WsFieldDefinition) => async (change: Partial<WsFieldDefinition>) => {
      const saved = await withFriendlyError(() => saveFieldDefinition({ ...d, ...change }));
      onChanged(defs.map((x) => (x.id === saved.id ? saved : x)));
    };
    return [
      { key: 'label', header: 'שם השדה', render: (d) => (
        <InlineEdit value={d.label} ariaLabel="שם השדה"
          onSave={(v) => { if (!v) throw new Error('שם חובה'); return patch(d)({ label: String(v) }); }} />) },
      { key: 'key', header: 'מפתח', render: (d) => <span className={styles.code}>{d.key}</span> },
      { key: 'type', header: 'סוג', render: (d) => (
        <InlineEdit type="select" value={d.field_type} options={FIELD_TYPE_OPTIONS}
          onSave={(v) => patch(d)({ field_type: v as FieldType })} />) },
      { key: 'options', header: 'אפשרויות', render: (d) => needsOptions(d.field_type) ? (
        <InlineEdit value={optionsToText(d.options)} placeholder="אפשרות א, אפשרות ב" ariaLabel="אפשרויות"
          onSave={(v) => patch(d)({ options: parseOptions(String(v ?? '')) })} />) : null },
      { key: 'required', header: 'חובה', render: (d) => (
        <input type="checkbox" checked={d.required} aria-label="שדה חובה" style={{ width: 'auto' }}
          onChange={(e) => { void patch(d)({ required: e.target.checked }).catch((err: Error) => toast(err.message)); }} />) },
      { key: 'position', header: 'מיקום', num: true, render: (d) => (
        <InlineEdit type="number" value={d.position}
          onSave={(v) => patch(d)({ position: Math.max(0, Math.round(Number(v ?? 0))) })} />) },
      { key: 'scope', header: 'היקף', render: (d) => <Pill label={d.organization_id ? 'ארגון' : 'גלובלי'} tone={d.organization_id ? 'blue' : 'gray'} /> },
      { key: 'archive', header: '', render: (d) => (
        <span className={styles.rowActions}>
          <ConfirmButton label="ארכוב" small tone="danger" confirmText="לארכב את השדה?"
            onConfirm={async () => {
              await withFriendlyError(() => archiveFieldDefinition(d.id));
              onChanged(defs.filter((x) => x.id !== d.id));
            }} />
        </span>) },
    ];
  }, [defs, onChanged]);

  return <DataTable columns={columns} rows={defs} rowKey={(d) => d.id} dense empty={empty} />;
}
