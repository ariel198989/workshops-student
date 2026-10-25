'use client';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageHeader } from '@/components/ui/PageHeader';
import { Spinner } from '@/components/ui/Spinner';
import { Layers01Icon } from '@hugeicons/core-free-icons';
import { ModuleDetail } from '@/components/ws/p6/ModuleDetail';
import { ModuleEditor } from '@/components/ws/p6/ModuleEditor';
import styles from '@/components/ws/p6/library.module.css';
import { listModules } from '@/lib/ws/curriculum';
import { toast, useStore } from '@/lib/store';
import { isCoreStaff, wsAuthStore } from '@/lib/ws/staff';
import type { WsModule } from '@/lib/ws/types';
import { errText } from '@/components/ws/p6/errors';

const BACK = '/curriculum';

/** Full-page facilitator guide for one module (id "new" opens an empty editor). */
export default function ModulePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const canEdit = isCoreStaff(useStore(wsAuthStore).whoami);
  const [module, setModule] = useState<WsModule | null | undefined>(undefined);

  useEffect(() => {
    if (id === 'new') { setModule(null); return; }
    let alive = true;
    listModules(true)
      .then((all) => { if (alive) setModule(all.find((m) => m.id === id) ?? null); })
      .catch((err: unknown) => {
        if (!alive) return;
        setModule(null);
        toast(errText('הטעינה נכשלה', err));
      });
    return () => { alive = false; };
  }, [id]);

  const back = <Link href={BACK} className="hint">חזרה לספרייה</Link>;
  if (module === undefined) return <div className="row"><Spinner /></div>;

  if (id === 'new') {
    return (
      <>
        <PageHeader title="מודול חדש" actions={back} />
        {canEdit
          ? <ModuleEditor initial={null} onCancel={() => router.push(BACK)} onSaved={(m) => router.replace(`${BACK}/modules/${m.id}`)} />
          : <p className="hint">אין הרשאה ליצירת מודולים.</p>}
      </>
    );
  }
  if (module === null) {
    return <EmptyState icon={Layers01Icon} title="המודול לא נמצא" text="ייתכן שהוא הועבר לארכיון." actions={back} />;
  }
  return (
    <>
      <PageHeader title="מדריך מודול" actions={back} />
      <div className={styles.detail}>
        <ModuleDetail key={`${module.id}:${module.version}`} module={module} canEdit={canEdit}
          onSaved={setModule} onArchived={() => router.push(BACK)}
          onCloned={(copy) => router.push(`${BACK}/modules/${copy.id}`)} />
      </div>
    </>
  );
}
