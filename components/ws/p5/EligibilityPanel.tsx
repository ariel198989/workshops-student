'use client';
import { useMemo, useState } from 'react';
import { ConfirmButton } from '../ConfirmButton';
import { DataTable, type Column } from '../DataTable';
import { Pill, StatusPill } from '../StatusPill';
import { issueCertificates } from '@/lib/ws/certificates';
import type { IssueResult } from '@/lib/ws/types';
import { hebrewDbError } from './validation';
import type { CertificatesData } from './certs-data';
import {
  DEFAULT_MIN_ATTENDANCE, SKIP_REASON_LABELS, canIssueInStatus, computeEligibility, summarize, type EligibilityRow,
} from './eligibility';
import styles from './p5.module.css';

interface EligibilityPanelProps {
  workshopId: string;
  data: CertificatesData;
  editable: boolean;
  onIssued: (result: IssueResult) => void;
}

const WHY_DISABLED = 'אפשר להנפיק תעודות רק כשהסדנה במצב חי או הושלמה.';

export function EligibilityPanel({ workshopId, data, editable, onIssued }: EligibilityPanelProps) {
  const [minPct, setMinPct] = useState(Math.round(DEFAULT_MIN_ATTENDANCE * 100));
  const [requireDeliverable, setRequireDeliverable] = useState(false);
  const statusOk = canIssueInStatus(data.head.status);

  const rows = useMemo(() => computeEligibility({
    participants: data.participants, sessions: data.sessions, attendance: data.attendance,
    deliverables: data.deliverables, minAttendance: minPct / 100, requireDeliverable,
    certifiedParticipantIds: new Set(data.certificates.map((c) => c.participant_id)),
  }), [data, minPct, requireDeliverable]);
  const { eligible, skipped } = summarize(rows);

  const issue = async () => {
    try {
      onIssued(await issueCertificates(workshopId, { minAttendance: minPct / 100, requireDeliverable }));
    } catch (err) {
      throw new Error(hebrewDbError(err));
    }
  };

  const columns: Column<EligibilityRow>[] = [
    { key: 'name', header: 'משתתף', sortValue: (r) => r.fullName, render: (r) => <span className="ink">{r.fullName}</span> },
    { key: 'att', header: 'נוכחות', num: true, sortValue: (r) => r.attendance, render: (r) => `${Math.round(r.attendance * 100)}%` },
    { key: 'del', header: 'תוצר', render: (r) => (r.deliverableStatus ? <StatusPill kind="deliverable" value={r.deliverableStatus} /> : '-') },
    { key: 'res', header: 'תוצאה', render: (r) => (r.reason
      ? <Pill label={SKIP_REASON_LABELS[r.reason]} tone={r.reason === 'already_issued' ? 'outline' : 'amber'} />
      : <Pill label="זכאי" tone="green" />) },
  ];

  return (
    <section className="stack">
      <div className={`hud card ${styles.issueBar}`}>
        <label className={styles.slider}>
          <span className="lbl">נוכחות מינימלית: <span className="num">{minPct}%</span></span>
          <input type="range" min={0} max={100} step={5} value={minPct} disabled={!editable}
            onChange={(e) => setMinPct(Number(e.target.value))} />
        </label>
        <label className={styles.checkRow}>
          <input type="checkbox" checked={requireDeliverable} disabled={!editable}
            onChange={(e) => setRequireDeliverable(e.target.checked)} />
          <span>דרוש תוצר מוגש</span>
        </label>
        <span className={styles.metaRow}>
          <span className="pill ok">{eligible} זכאים</span>
          <span className="pill idle">{skipped} ידולגו</span>
        </span>
        <ConfirmButton tone="primary" label="הנפקת תעודות" confirmText={`להנפיק ${eligible} תעודות?`}
          disabled={!editable || !statusOk || eligible === 0} onConfirm={issue} />
      </div>
      {!statusOk ? <p className="hint" role="note">{WHY_DISABLED}</p> : null}
      <DataTable columns={columns} rows={rows} rowKey={(r) => r.participantId} dense
        empty={<p className="hint">אין עדיין משתתפים פעילים בסדנה.</p>} />
    </section>
  );
}
