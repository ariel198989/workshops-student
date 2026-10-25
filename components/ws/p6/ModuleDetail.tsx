'use client';
import Link from 'next/link';
import { useState } from 'react';
import { archiveModule, saveModule } from '@/lib/ws/curriculum';
import { toast } from '@/lib/store';
import type { WsModule } from '@/lib/ws/types';
import { ConfirmButton } from '../ConfirmButton';
import { ModuleContentView } from './ModuleContentView';
import { ModuleEditor } from './ModuleEditor';
import { cloneInput } from './module-form';
import styles from './library.module.css';
import { errText } from './errors';

interface Props {
  module: WsModule;
  canEdit: boolean;
  onSaved: (saved: WsModule) => void;
  onArchived: (id: string) => void;
  onCloned: (copy: WsModule) => void;
  /** link to the full-page view; omitted when already on it */
  fullPageHref?: string;
}

/** Read view with the action bar (edit, clone, archive). Switches to the editor in place. */
export function ModuleDetail({ module: m, canEdit, onSaved, onArchived, onCloned, fullPageHref }: Props) {
  const [editing, setEditing] = useState(false);

  const clone = async () => {
    try {
      const copy = await saveModule(cloneInput(m));
      toast('נוצר עותק, אפשר לערוך אותו', true);
      onCloned(copy);
    } catch (err) {
      toast(errText('השכפול נכשל', err));
    }
  };

  if (editing) {
    return (
      <ModuleEditor initial={m} onCancel={() => setEditing(false)}
        onSaved={(saved) => { setEditing(false); onSaved(saved); }} />
    );
  }
  return (
    <>
      <div className={styles.detailBar}>
        {canEdit ? (
          <>
            <button type="button" className="primary sm" onClick={() => setEditing(true)}>עריכה</button>
            <button type="button" className="sm" onClick={() => void clone()}>שכפול</button>
            <ConfirmButton small tone="danger" label="ארכוב" confirmText="להעביר לארכיון?"
              onConfirm={async () => { await archiveModule(m.id); onArchived(m.id); }} />
          </>
        ) : (
          <span className="hint">תצוגה בלבד</span>
        )}
        <span className="spacer" />
        {fullPageHref ? <Link href={fullPageHref} className="hint">מסך מלא</Link> : null}
      </div>
      <ModuleContentView module={m} />
    </>
  );
}
