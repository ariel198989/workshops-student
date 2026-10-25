'use client';
import { DataTable, type Column } from '../DataTable';
import { Pill } from '../StatusPill';
import type { CityModel } from '@/lib/types';
import { formatDateHe } from '@/lib/ws/certificate-templates';
import { formatAccuracy } from './snapshot';
import styles from './p5.module.css';

const PERSONAL_PREFIX = 'אישי · ';
export const isPersonalModel = (m: Pick<CityModel, 'team_name'>): boolean => m.team_name.startsWith(PERSONAL_PREFIX);

interface ModelPickerProps {
  models: readonly CityModel[];
  selectedId: string | null;
  disabled: boolean;
  onPick: (model: CityModel) => void;
}

/** Models trained by the group (team or personal accounts) from sc_models, newest first. */
export function ModelPicker({ models, selectedId, disabled, onPick }: ModelPickerProps) {
  const columns: Column<CityModel>[] = [
    { key: 'name', header: 'מודל', render: (m) => <span className="ink" dir="auto">{m.name}</span> },
    { key: 'accuracy', header: 'דיוק', num: true, sortValue: (m) => m.accuracy, render: (m) => formatAccuracy(m.accuracy) },
    { key: 'flags', header: 'מצב', render: (m) => (
      <span className={styles.metaRow}>
        {m.approved ? <Pill label="מאושר" tone="teal" /> : <Pill label="לא מאושר" tone="outline" />}
        {isPersonalModel(m) ? <Pill label="אישי" tone="amber" /> : null}
      </span>
    ) },
    { key: 'created', header: 'נוצר', sortValue: (m) => m.created_at, render: (m) => formatDateHe(m.created_at) },
    { key: 'pick', header: '', render: (m) => (
      <button type="button" className={m.id === selectedId ? 'primary sm' : 'sm'}
        disabled={disabled || m.id === selectedId} onClick={() => onPick(m)}>
        {m.id === selectedId ? 'נבחר' : 'בחירה'}
      </button>
    ) },
  ];

  return (
    <DataTable columns={columns} rows={models} rowKey={(m) => m.id} dense
      empty={<p className="hint">אין עדיין מודלים לקבוצה הזו.</p>} />
  );
}
