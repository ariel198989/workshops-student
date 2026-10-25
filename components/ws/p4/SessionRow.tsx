'use client';
import { useState } from 'react';
import { InlineEdit, type InlineOption } from '@/components/ws/InlineEdit';
import { StatusPill } from '@/components/ws/StatusPill';
import { toast } from '@/lib/store';
import { labelOf } from '@/lib/ws/labels';
import { updateSession, type SessionPatch } from '@/lib/ws/workshops';
import { SESSION_STATUSES, type SessionStatus, type WsSession, type WsSessionModule } from '@/lib/ws/types';
import { formatDateTime } from './format';
import { errorText } from './hooks';
import { SessionModules } from './SessionModules';
import styles from './flow.module.css';

const STATUS_OPTIONS: readonly InlineOption[] = SESSION_STATUSES.map((s) => ({ value: s, label: labelOf('session', s) }));
const asText = (v: string | number | null): string | null => (v === null ? null : String(v));

interface SessionRowProps {
  session: WsSession;
  open: boolean;
  canEdit: boolean;
  onToggle: () => void;
  onOpenModule: (module: WsSessionModule) => void;
}

/** One meeting: collapsed header, expanded editable fields and its modules. */
export function SessionRow({ session, open, canEdit, onToggle, onOpenModule }: SessionRowProps) {
  const [s, setS] = useState(session);
  const [busy, setBusy] = useState(false);

  const patch = async (change: SessionPatch) => {
    setS(await updateSession(s.id, change));
  };

  const run = async (change: SessionPatch) => {
    setBusy(true);
    try {
      await patch(change);
    } catch (err) {
      toast(errorText(err, 'העדכון נכשל'));
    } finally {
      setBusy(false);
    }
  };

  const date = formatDateTime(s.scheduled_at);
  return (
    <li id={`s${s.session_no}`} className={`${styles.session} ${open ? styles.sessionOpen : ''}`}>
      <button type="button" className={styles.sHead} onClick={onToggle} aria-expanded={open}>
        <span className={styles.sNo}>{s.session_no}</span>
        <span className={styles.sTitle}>{s.title}</span>
        <StatusPill kind="session" value={s.status} />
        <span className={styles.sMeta}>
          {date ? <span>{date}</span> : null}
          <span className={styles.chev} aria-hidden="true">◂</span>
        </span>
      </button>
      {open ? (
        <div className={styles.sBody}>
          <div className={styles.fields}>
            <div className={styles.fieldBox}>
              <span className="lbl">מועד</span>
              <InlineEdit type="datetime" value={s.scheduled_at} disabled={!canEdit} ariaLabel="מועד המפגש"
                display={(v) => (v === null ? null : formatDateTime(String(v)))}
                onSave={(v) => patch({ scheduled_at: asText(v) })} />
            </div>
            <div className={styles.fieldBox}>
              <span className="lbl">מיקום</span>
              <InlineEdit value={s.location} disabled={!canEdit} ariaLabel="מיקום"
                onSave={(v) => patch({ location: asText(v) })} />
            </div>
            <div className={styles.fieldBox}>
              <span className="lbl">סטטוס</span>
              <InlineEdit type="select" value={s.status} options={STATUS_OPTIONS} disabled={!canEdit} ariaLabel="סטטוס"
                onSave={(v) => v ? patch({ status: v as SessionStatus }) : undefined} />
            </div>
          </div>
          <div className={styles.recap}>
            <span className="lbl">סיכום המפגש</span>
            <InlineEdit type="textarea" value={s.recap} disabled={!canEdit} placeholder="לחצו לכתיבת סיכום" ariaLabel="סיכום"
              display={(v) => (v === null ? null : <span className={styles.lines}>{String(v)}</span>)}
              onSave={(v) => patch({ recap: asText(v) })} />
          </div>
          {canEdit ? (
            <div className={styles.actions}>
              {s.status !== 'live' && s.status !== 'done' ? (
                <button type="button" className="primary sm" disabled={busy}
                  onClick={() => void run({ status: 'live', started_at: new Date().toISOString() })}>
                  התחל מפגש
                </button>
              ) : null}
              {s.status === 'live' ? (
                <button type="button" className="hot sm" disabled={busy}
                  onClick={() => void run({ status: 'done', ended_at: new Date().toISOString() })}>
                  סיים מפגש
                </button>
              ) : null}
            </div>
          ) : null}
          <SessionModules sessionId={s.id} canEdit={canEdit} onOpen={onOpenModule} />
        </div>
      ) : null}
    </li>
  );
}
