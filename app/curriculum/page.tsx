'use client';
import { useEffect, useState } from 'react';
import { PageHeader } from '@/components/ui/PageHeader';
import { ModuleLibrary } from '@/components/ws/p6/ModuleLibrary';
import { TemplatesTab } from '@/components/ws/p6/TemplatesTab';
import styles from '@/components/ws/p6/library.module.css';

type Tab = 'library' | 'templates';
const TABS: readonly { id: Tab; label: string }[] = [
  { id: 'library', label: 'ספריית מודולים' },
  { id: 'templates', label: 'תבניות' },
];

export default function CurriculumPage() {
  const [tab, setTab] = useState<Tab>('library');

  // #templates survives the round trip from /curriculum/templates/[id]
  useEffect(() => {
    if (window.location.hash === '#templates') setTab('templates');
  }, []);

  const choose = (next: Tab) => {
    setTab(next);
    window.history.replaceState(null, '', next === 'templates' ? '#templates' : window.location.pathname);
  };

  return (
    <>
      <PageHeader title="תבניות וקוריקולום" subtitle="ספריית המודולים ותבניות הסדנה." />
      <div className={styles.tabs} role="tablist">
        {TABS.map((t) => (
          <button key={t.id} type="button" role="tab" aria-selected={tab === t.id}
            className={`${styles.tab} ${tab === t.id ? styles.tabOn : ''}`} onClick={() => choose(t.id)}>
            {t.label}
          </button>
        ))}
      </div>
      {tab === 'library' ? <ModuleLibrary /> : <TemplatesTab />}
    </>
  );
}
