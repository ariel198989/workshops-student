'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Layers01Icon } from '@hugeicons/core-free-icons';
import { EmptyState } from '@/components/ui/EmptyState';
import { Spinner } from '@/components/ui/Spinner';
import { sb } from '@/lib/db';
import { listTemplates } from '@/lib/ws/curriculum';
import { toast } from '@/lib/store';
import type { WsCurriculumTemplate } from '@/lib/ws/types';
import { Pill } from '../StatusPill';
import { templateStats, type TemplateStat, type TemplateStatRow } from './board';
import { FORMAT_LABELS } from './labels';
import styles from './library.module.css';
import { errText } from './errors';

const NO_STAT: TemplateStat = { sessions: 0, minutes: 0, modules: 0 };

async function loadStats(): Promise<Record<string, TemplateStat>> {
  const { data, error } = await sb.from('ws_template_modules')
    .select('template_id, session_no, duration_override, module:ws_modules(duration_minutes)');
  if (error) throw error;
  return templateStats(data as unknown as TemplateStatRow[]);
}

function TemplateCard({ tpl, stat }: { tpl: WsCurriculumTemplate; stat: TemplateStat }) {
  return (
    <Link href={`/curriculum/templates/${tpl.id}`} className={styles.tplCard}>
      <div className={styles.tplStats}>
        <Pill label={FORMAT_LABELS[tpl.format]} tone="blue" />
        {tpl.is_default ? <Pill label="ברירת מחדל" tone="teal" /> : null}
      </div>
      <h3 className={styles.tplTitle}>{tpl.title}</h3>
      {tpl.description ? <p className={styles.tplDesc}>{tpl.description}</p> : null}
      <div className={styles.tplNums}>
        <span><b>{stat.sessions}</b>מפגשים</span>
        <span><b>{stat.minutes}</b>דקות</span>
        <span><b>{stat.modules}</b>מודולים</span>
      </div>
    </Link>
  );
}

export function TemplatesTab() {
  const [templates, setTemplates] = useState<WsCurriculumTemplate[] | null>(null);
  const [stats, setStats] = useState<Record<string, TemplateStat>>({});

  useEffect(() => {
    let alive = true;
    Promise.all([listTemplates(), loadStats()])
      .then(([tpls, st]) => { if (alive) { setTemplates(tpls); setStats(st); } })
      .catch((err: unknown) => {
        if (!alive) return;
        setTemplates([]);
        toast(errText('הטעינה נכשלה', err));
      });
    return () => { alive = false; };
  }, []);

  if (templates === null) return <div className="row"><Spinner /></div>;
  if (templates.length === 0) {
    return <EmptyState icon={Layers01Icon} title="אין תבניות" text="התבניות מופיעות כאן אחרי שיובאו או נוצרו." />;
  }
  return (
    <div className={styles.tplGrid}>
      {templates.map((t) => <TemplateCard key={t.id} tpl={t} stat={stats[t.id] ?? NO_STAT} />)}
    </div>
  );
}
