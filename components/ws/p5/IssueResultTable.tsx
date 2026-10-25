'use client';
import { DataTable, type Column } from '../DataTable';
import { Pill } from '../StatusPill';
import type { IssueResult } from '@/lib/ws/types';
import { SKIP_REASON_LABELS } from './eligibility';

type Skipped = IssueResult['skipped'][number];

const COLUMNS: Column<Skipped>[] = [
  { key: 'name', header: 'משתתף', render: (r) => <span className="ink">{r.full_name}</span> },
  { key: 'reason', header: 'סיבה', render: (r) => <Pill label={SKIP_REASON_LABELS[r.reason]} tone="amber" /> },
  { key: 'att', header: 'נוכחות', num: true, render: (r) => `${Math.round(r.attendance * 100)}%` },
];

interface IssueResultTableProps {
  result: IssueResult;
  onClose: () => void;
}

/** Outcome of the last issue run: how many were issued and who was skipped, with the reason. */
export function IssueResultTable({ result, onClose }: IssueResultTableProps) {
  return (
    <section className="hud card" aria-live="polite">
      <header className="row">
        <h3>תוצאת ההנפקה</h3>
        <span className="pill ok">{result.issued} הונפקו</span>
        <span className="pill idle">{result.skipped.length} דולגו</span>
        <button type="button" className="ghost sm" onClick={onClose}>סגירה</button>
      </header>
      {result.skipped.length > 0 ? (
        <DataTable columns={COLUMNS} rows={result.skipped} rowKey={(r) => r.participant_id} dense empty={null} />
      ) : null}
    </section>
  );
}
