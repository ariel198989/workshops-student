'use client';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { Layers01Icon } from '@hugeicons/core-free-icons';
import { EmptyState } from '@/components/ui/EmptyState';
import { Spinner } from '@/components/ui/Spinner';
import { ModulePicker } from '@/components/ws/p6/ModulePicker';
import { TemplateHeader } from '@/components/ws/p6/TemplateHeader';
import { TemplateModuleList } from '@/components/ws/p6/TemplateModuleList';
import { sessionTarget, totalMinutes } from '@/components/ws/p6/board';
import { TYPE_TONES, typeLabel } from '@/components/ws/p6/labels';
import { useTemplateBoard } from '@/components/ws/p6/useTemplateBoard';
import styles from '@/components/ws/p6/board.module.css';
import { useStore } from '@/lib/store';
import { isCoreStaff, wsAuthStore } from '@/lib/ws/staff';

const TYPE_COLORS: Record<keyof typeof TYPE_TONES, string> = {
  theory: '#2563EB', practice: '#17948C', demo: '#D97706', mixed: '#0F1C2E',
};

/** One template: sessions as columns, drag to reorder or move between sessions. */
export default function TemplatePage() {
  const { id } = useParams<{ id: string }>();
  const canEdit = isCoreStaff(useStore(wsAuthStore).whoami);
  const board = useTemplateBoard(id);
  const [pickFor, setPickFor] = useState<number | null>(null);

  if (board.tpl === undefined) return <div className="row"><Spinner /></div>;
  if (board.tpl === null) {
    return (
      <EmptyState icon={Layers01Icon} title="התבנית לא נמצאה" text="ייתכן שהיא הועברה לארכיון."
        actions={<Link href="/curriculum#templates">חזרה לתבניות</Link>} />
    );
  }

  const total = totalMinutes(board.items);
  const sessions = board.columns.filter((c) => c.ids.length > 0).length;

  return (
    <>
      <TemplateHeader template={board.tpl} canEdit={canEdit} sessions={sessions} minutes={total}
        onChanged={(next) => board.setTpl((cur) => (cur ? { ...cur, ...next } : cur))} />
      <div className={styles.legend}>
        {(Object.keys(TYPE_COLORS) as (keyof typeof TYPE_COLORS)[]).map((k) => (
          <span key={k}><i style={{ background: TYPE_COLORS[k] }} />{typeLabel(k)}</span>
        ))}
        {canEdit ? <span>גררו מודולים בין מפגשים או בתוך מפגש</span> : null}
      </div>
      {board.columns.length === 0 ? (
        <EmptyState icon={Layers01Icon} title="התבנית ריקה" text="הוסיפו מודול ראשון כדי להתחיל."
          actions={canEdit ? <button type="button" className="primary" onClick={() => setPickFor(1)}>הוסיפו מודול</button> : undefined} />
      ) : (
        <TemplateModuleList columns={board.columns} rows={board.rows} items={board.items}
          target={sessionTarget(board.tpl.format, total)} canEdit={canEdit}
          onMove={board.move} onRemove={(rowId) => void board.remove(rowId)}
          onAdd={setPickFor} onAddSession={board.addSession} />
      )}
      <ModulePicker open={pickFor !== null} sessionNo={pickFor ?? 1} onClose={() => setPickFor(null)}
        onPick={(moduleId) => { const s = pickFor; setPickFor(null); if (s !== null) void board.add(s, moduleId); }} />
    </>
  );
}
