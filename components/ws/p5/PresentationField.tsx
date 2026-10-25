'use client';
import { useState } from 'react';
import { signedPdfUrl } from '@/lib/ws/certificates';
import { toast } from '@/lib/store';
import type { WsDeliverable } from '@/lib/ws/types';
import { patchDeliverable, uploadSafe } from './api';
import { hebrewDbError, isHttpsUrl } from './validation';
import styles from './p5.module.css';

interface PresentationFieldProps {
  row: Pick<WsDeliverable, 'id' | 'workshop_id' | 'group_id' | 'presentation_url' | 'presentation_path'>;
  disabled: boolean;
  onChanged: () => void;
}

const URL_ERROR = 'הקישור חייב להתחיל ב-https://';

/** Link (https only) and/or an uploaded file (pdf, png, jpg, pptx up to 50MB). */
export function PresentationField({ row, disabled, onChanged }: PresentationFieldProps) {
  const [url, setUrl] = useState(row.presentation_url ?? '');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const run = async (task: () => Promise<void>) => {
    setBusy(true);
    try {
      await task();
      onChanged();
    } catch (err) {
      toast(err instanceof Error ? err.message : hebrewDbError(err));
    } finally {
      setBusy(false);
    }
  };

  const saveUrl = () => {
    const value = url.trim();
    if (value !== '' && !isHttpsUrl(value)) { setError(URL_ERROR); return; }
    setError('');
    if (value === (row.presentation_url ?? '')) return;
    void run(() => patchDeliverable(row.id, { presentation_url: value === '' ? null : value }));
  };

  const upload = (file: File | undefined) => {
    if (file) void run(async () => { await uploadSafe(row.workshop_id, row.group_id, file); });
  };

  const openFile = () => run(async () => {
    if (row.presentation_path) window.open(await signedPdfUrl(row.presentation_path), '_blank', 'noopener,noreferrer');
  });

  return (
    <div className="stack">
      <div className={styles.metaRow}>
        <input type="text" dir="ltr" inputMode="url" placeholder="https://" value={url} disabled={disabled || busy}
          aria-label="קישור למצגת" onChange={(e) => setUrl(e.target.value)} onBlur={saveUrl}
          onKeyDown={(e) => { if (e.key === 'Enter') saveUrl(); }} className={styles.urlInput} />
        {row.presentation_url ? (
          <a href={row.presentation_url} target="_blank" rel="noopener noreferrer">פתיחה</a>
        ) : null}
      </div>
      {error ? <p className="err" role="alert">{error}</p> : null}
      <div className={styles.metaRow}>
        {disabled ? null : (
          <input type="file" accept=".pdf,.png,.jpg,.jpeg,.pptx" disabled={busy} aria-label="העלאת קובץ מצגת"
            onChange={(e) => { upload(e.target.files?.[0]); e.target.value = ''; }} />
        )}
        {row.presentation_path ? (
          <button type="button" className="sm" disabled={busy} onClick={() => void openFile()}>פתיחת הקובץ שהועלה</button>
        ) : null}
      </div>
    </div>
  );
}
