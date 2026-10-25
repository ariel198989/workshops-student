'use client';
import type { ReactNode } from 'react';
import { AUDIENCES, AUDIENCE_LABELS, MODULE_TYPE_LABELS, PIPELINE_STAGES, STAGE_LABELS } from './labels';
import { EMPTY_FILTERS, hasActiveFilters, type ModuleFilters } from './filters';
import styles from './library.module.css';

interface Props {
  value: ModuleFilters;
  onChange: (next: ModuleFilters) => void;
  /** rendered after the filters, e.g. the "new module" button */
  actions?: ReactNode;
}

export function ModuleFiltersBar({ value, onChange, actions }: Props) {
  const set = (p: Partial<ModuleFilters>) => onChange({ ...value, ...p });
  return (
    <div className={styles.filters} role="search">
      <input type="search" placeholder="חיפוש מודול" aria-label="חיפוש" value={value.search}
        onChange={(e) => set({ search: e.target.value })} />
      <select aria-label="שלב" value={value.stage} onChange={(e) => set({ stage: e.target.value })}>
        <option value="">כל השלבים</option>
        {PIPELINE_STAGES.map((s) => <option key={s} value={s}>{STAGE_LABELS[s]}</option>)}
      </select>
      <select aria-label="סוג" value={value.type} onChange={(e) => set({ type: e.target.value })}>
        <option value="">כל הסוגים</option>
        {Object.entries(MODULE_TYPE_LABELS).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
      </select>
      <select aria-label="קהל" value={value.audience} onChange={(e) => set({ audience: e.target.value })}>
        <option value="">כל הקהלים</option>
        {AUDIENCES.map((a) => <option key={a} value={a}>{AUDIENCE_LABELS[a]}</option>)}
      </select>
      <label className={styles.filterCheck}>
        <input type="checkbox" checked={value.requiresApp} onChange={(e) => set({ requiresApp: e.target.checked })} />
        דורש אפליקציה
      </label>
      {hasActiveFilters(value) ? (
        <button type="button" className="ghost sm" onClick={() => onChange(EMPTY_FILTERS)}>ניקוי</button>
      ) : null}
      <span className={styles.filterSpacer} />
      {actions}
    </div>
  );
}
