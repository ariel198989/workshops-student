'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { cloneTemplate } from '@/lib/ws/curriculum';
import { toast } from '@/lib/store';
import type { WsCurriculumTemplate } from '@/lib/ws/types';
import { InlineEdit } from '../InlineEdit';
import { Pill } from '../StatusPill';
import { templateErrorText } from './errors';
import { FORMAT_LABELS } from './labels';
import { updateTemplate, type TemplatePatch } from './template-data';
import styles from './board.module.css';

interface Props {
  template: WsCurriculumTemplate;
  canEdit: boolean;
  sessions: number;
  minutes: number;
  onChanged: (next: WsCurriculumTemplate) => void;
}

const COPY_SUFFIX = ' (עותק)';

export function TemplateHeader({ template: t, canEdit, sessions, minutes, onChanged }: Props) {
  const router = useRouter();

  // throws a Hebrew message so InlineEdit's toast explains a rejected value
  const patch = async (p: TemplatePatch) => {
    try {
      onChanged(await updateTemplate(t.id, p));
    } catch (err) {
      throw new Error(templateErrorText(err, 'העדכון נכשל'));
    }
  };

  const toggleDefault = async () => {
    try {
      await patch({ is_default: !t.is_default });
    } catch (err) {
      toast(err instanceof Error ? err.message : 'העדכון נכשל');
    }
  };

  const clone = async () => {
    try {
      const id = await cloneTemplate(t.id, `${t.title}${COPY_SUFFIX}`);
      toast('התבנית שוכפלה', true);
      router.push(`/curriculum/templates/${id}`);
    } catch (err) {
      toast(templateErrorText(err, 'השכפול נכשל'));
    }
  };

  return (
    <div className={styles.hdr}>
      <div className={styles.hdrRow}>
        <Link href="/curriculum#templates" className="hint">חזרה לתבניות</Link>
      </div>
      <div className={styles.hdrRow}>
        <h1 className={styles.hdrTitle}>
          <InlineEdit value={t.title} disabled={!canEdit} ariaLabel="שם התבנית"
            onSave={(v) => {
              if (typeof v !== 'string' || v.trim().length < 2) throw new Error('שם התבנית קצר מדי');
              return patch({ title: v.trim() });
            }} />
        </h1>
        <Pill label={FORMAT_LABELS[t.format]} tone="blue" />
        {t.is_default ? <Pill label="ברירת מחדל" tone="teal" /> : null}
        <span className="hint">{sessions} מפגשים, {minutes} דקות</span>
        <span style={{ flex: 1 }} />
        {canEdit ? (
          <>
            <button type="button" className="sm" onClick={() => void toggleDefault()}>
              {t.is_default ? 'הסרת ברירת מחדל' : 'קביעה כברירת מחדל'}
            </button>
            <button type="button" className="sm" onClick={() => void clone()}>שכפול תבנית</button>
          </>
        ) : null}
      </div>
      <div className={styles.hdrDesc}>
        <InlineEdit type="textarea" value={t.description} disabled={!canEdit} placeholder="הוסיפו תיאור"
          ariaLabel="תיאור התבנית" onSave={(v) => patch({ description: typeof v === 'string' ? v.trim() : null })} />
      </div>
    </div>
  );
}
