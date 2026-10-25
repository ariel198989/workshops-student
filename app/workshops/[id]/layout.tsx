'use client';
import { Fragment, useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useParams, usePathname, useRouter } from 'next/navigation';
import { Calendar01Icon } from '@hugeicons/core-free-icons';
import { EmptyState } from '@/components/ui/EmptyState';
import { Spinner } from '@/components/ui/Spinner';
import { StatusPill } from '@/components/ws/StatusPill';
import { TabStrip, type TabItem } from '@/components/ws/TabStrip';
import { WorkshopStatusBar } from '@/components/ws/p3/WorkshopStatusBar';
import styles from '@/components/ws/p3/p3.module.css';
import { bumpData, toast, useStore } from '@/lib/store';
import { getOrganization } from '@/lib/ws/orgs';
import { canEdit, isAdmin, wsAuthStore } from '@/lib/ws/staff';
import type { WsWorkshop } from '@/lib/ws/types';
import { getWorkshop } from '@/lib/ws/workshops';

const TABS: readonly TabItem[] = [
  { id: 'overview', label: 'סקירה' },
  { id: 'sessions', label: 'מפגשים' },
  { id: 'groups', label: 'קבוצות' },
  { id: 'participants', label: 'משתתפים' },
  { id: 'attendance', label: 'נוכחות' },
  { id: 'problems', label: 'בעיות' },
  { id: 'deliverables', label: 'תוצרים' },
  { id: 'certificates', label: 'תעודות' },
  { id: 'settings', label: 'הגדרות' },
];

/** Active tab = the path segment right after /workshops/<id>/. */
function activeTab(pathname: string | null, id: string): string {
  const rest = (pathname ?? '').split(`/workshops/${id}/`)[1] ?? '';
  const seg = rest.split('/')[0];
  return TABS.some((t) => t.id === seg) ? seg : 'overview';
}

export default function WorkshopLayout({ children }: { children: ReactNode }) {
  const { id } = useParams<{ id: string }>();
  const pathname = usePathname();
  const router = useRouter();
  const { whoami } = useStore(wsAuthStore);
  const [workshop, setWorkshop] = useState<WsWorkshop | null | undefined>(undefined);
  const [orgName, setOrgName] = useState<string | null>(null);
  // bumped after a status change so every tab remounts and refetches
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let live = true;
    setWorkshop(undefined);
    getWorkshop(id)
      .then((w) => {
        if (!live) return;
        setWorkshop(w);
        getOrganization(w.organization_id).then((o) => { if (live) setOrgName(o.name); }).catch(() => undefined);
      })
      .catch(() => { if (live) setWorkshop(null); });
    return () => { live = false; };
  }, [id]);

  if (workshop === null) {
    return (
      <EmptyState icon={Calendar01Icon} title="הסדנה לא נמצאה" text="ייתכן שהיא נמחקה או שאין לכם גישה אליה."
        actions={<button type="button" className="primary" onClick={() => router.push('/workshops')}>חזרה לסדנאות</button>} />
    );
  }

  const changed = (next: WsWorkshop) => {
    setWorkshop(next);
    setVersion((v) => v + 1);
    bumpData();
    toast('הסטטוס עודכן', true);
  };

  return (
    <>
      <header className={styles.wsHead}>
        <div>
          <Link href="/workshops" className={styles.crumb}>סדנאות</Link>
          {workshop === undefined ? <Spinner /> : (
            <>
              <h1 className={styles.wsTitle}>{workshop.title}</h1>
              <div className={styles.wsMeta}>
                {orgName ? <Link href={`/orgs/${workshop.organization_id}`} className={styles.link}>{orgName}</Link> : null}
                <span className={styles.code}>{workshop.code}</span>
                <StatusPill kind="workshop" value={workshop.status} />
              </div>
            </>
          )}
        </div>
        {workshop && canEdit(whoami, id) ? (
          <WorkshopStatusBar workshop={workshop} admin={isAdmin(whoami)} onChanged={changed} />
        ) : null}
      </header>
      <TabStrip base={`/workshops/${id}`} tabs={TABS} active={activeTab(pathname, id)} />
      <Fragment key={version}>{children}</Fragment>
    </>
  );
}
