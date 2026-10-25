'use client';
import { useEffect, useState } from 'react';
import { listSessions } from '@/lib/ws/workshops';
import type { WsSessionModule } from '@/lib/ws/types';
import { InstantiateEmpty } from '@/components/ws/p4/InstantiateEmpty';
import { LoadGate } from '@/components/ws/p4/LoadGate';
import { ModuleDrawer } from '@/components/ws/p4/ModuleDrawer';
import { SessionRow } from '@/components/ws/p4/SessionRow';
import { useCanEdit, useLoader, useWorkshopId } from '@/components/ws/p4/hooks';
import styles from '@/components/ws/p4/flow.module.css';

/** "#s3" -> 3 (the overview timeline links here) */
function hashSessionNo(): number | null {
  const m = /^#s(\d+)$/.exec(window.location.hash);
  return m ? Number(m[1]) : null;
}

export default function SessionsPage() {
  const id = useWorkshopId();
  const canEdit = useCanEdit(id);
  const { data: sessions, error, loading, reload } = useLoader(() => listSessions(id), id);
  const [openNo, setOpenNo] = useState<number | null>(null);
  const [module, setModule] = useState<WsSessionModule | null>(null);

  // open and scroll to the session named in the URL hash, also when the hash changes in place
  useEffect(() => {
    const sync = () => {
      const no = hashSessionNo();
      if (no === null) return;
      setOpenNo(no);
      requestAnimationFrame(() => document.getElementById(`s${no}`)?.scrollIntoView({ block: 'start' }));
    };
    if (sessions) sync();
    window.addEventListener('hashchange', sync);
    return () => window.removeEventListener('hashchange', sync);
  }, [sessions]);

  return (
    <LoadGate loading={loading} error={error} hasData={!!sessions} onRetry={() => void reload()}>
      {sessions && sessions.length === 0 ? (
        <InstantiateEmpty workshopId={id} canEdit={canEdit} onDone={() => void reload()} />
      ) : null}
      {sessions && sessions.length > 0 ? (
        <>
          <div className={styles.bar}>
            <h2>מפגשים</h2>
            <span className={styles.stamp}>{sessions.length} מפגשים</span>
          </div>
          <ul className={styles.sessions}>
            {sessions.map((s) => (
              <SessionRow key={s.id} session={s} canEdit={canEdit} open={openNo === s.session_no}
                onToggle={() => setOpenNo(openNo === s.session_no ? null : s.session_no)}
                onOpenModule={setModule} />
            ))}
          </ul>
          <ModuleDrawer module={module} onClose={() => setModule(null)} />
        </>
      ) : null}
    </LoadGate>
  );
}
