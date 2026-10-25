'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Layers01Icon } from '@hugeicons/core-free-icons';
import { EmptyState } from '@/components/ui/EmptyState';
import { Spinner } from '@/components/ui/Spinner';
import { listModules } from '@/lib/ws/curriculum';
import { toast, useStore } from '@/lib/store';
import { isCoreStaff, wsAuthStore } from '@/lib/ws/staff';
import type { WsModule } from '@/lib/ws/types';
import { EMPTY_FILTERS, filterModules, type ModuleFilters } from './filters';
import { ModuleCard } from './ModuleCard';
import { ModuleDetail } from './ModuleDetail';
import { ModuleEditor } from './ModuleEditor';
import { ModuleFiltersBar } from './ModuleFiltersBar';
import styles from './library.module.css';
import { errText } from './errors';

type Mode = { kind: 'view' } | { kind: 'new' };

export function ModuleLibrary() {
  const { whoami } = useStore(wsAuthStore);
  const canEdit = isCoreStaff(whoami);
  const [modules, setModules] = useState<WsModule[] | null>(null);
  const [filters, setFilters] = useState<ModuleFilters>(EMPTY_FILTERS);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>({ kind: 'view' });

  const load = useCallback(async () => {
    try {
      setModules(await listModules());
    } catch (err) {
      setModules([]);
      toast(errText('הטעינה נכשלה', err));
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const visible = useMemo(() => filterModules(modules ?? [], filters), [modules, filters]);
  const selected = modules?.find((m) => m.id === selectedId) ?? null;

  const upsert = (saved: WsModule) => {
    setModules((list) => {
      const rest = (list ?? []).filter((m) => m.id !== saved.id);
      return [...rest, saved].sort((a, b) => a.title.localeCompare(b.title, 'he'));
    });
    setSelectedId(saved.id);
    setMode({ kind: 'view' });
  };
  const remove = (id: string) => {
    setModules((list) => (list ?? []).filter((m) => m.id !== id));
    setSelectedId(null);
  };

  if (modules === null) return <div className="row"><Spinner /></div>;

  const newButton = canEdit ? (
    <button type="button" className="primary sm" onClick={() => { setSelectedId(null); setMode({ kind: 'new' }); }}>
      מודול חדש
    </button>
  ) : null;

  if (modules.length === 0) {
    return (
      <EmptyState icon={Layers01Icon} title={canEdit ? 'הספרייה ריקה' : 'אין גישה לספריית המודולים'}
        text={canEdit ? 'צרו את המודול הראשון.' : 'הספרייה זמינה לצוות הליבה בלבד.'}
        actions={newButton} />
    );
  }

  return (
    <>
      <ModuleFiltersBar value={filters} onChange={setFilters} actions={newButton} />
      <div className={styles.layout}>
        <div>
          <div className={styles.listCount}>{visible.length} מתוך {modules.length} מודולים</div>
          <div className={styles.list}>
            {visible.map((m) => (
              <ModuleCard key={m.id} module={m} selected={m.id === selectedId}
                onSelect={(id) => { setSelectedId(id); setMode({ kind: 'view' }); }} />
            ))}
            {visible.length === 0 ? <p className="hint">אין מודולים שמתאימים לסינון.</p> : null}
          </div>
        </div>
        <div className={styles.detail}>
          {mode.kind === 'new' ? (
            <ModuleEditor initial={null} onSaved={upsert} onCancel={() => setMode({ kind: 'view' })} />
          ) : selected ? (
            <ModuleDetail key={selected.id} module={selected} canEdit={canEdit}
              fullPageHref={`/curriculum/modules/${selected.id}`}
              onSaved={upsert} onArchived={remove} onCloned={upsert} />
          ) : (
            <div className={styles.placeholder}>בחרו מודול מהרשימה.</div>
          )}
        </div>
      </div>
    </>
  );
}
