'use client';
import { useEffect, useState } from 'react';
import { Calendar01Icon } from '@hugeicons/core-free-icons';
import { EmptyState } from '@/components/ui/EmptyState';
import { Spinner } from '@/components/ui/Spinner';
import { useStore } from '@/lib/store';
import {
  countOrganizations, isNewInstall, listRecentEvents, listWeekSessions, myWorkshops,
  type EventWithWorkshop, type SessionWithWorkshop,
} from '@/lib/ws/dashboard';
import { isAdmin, wsAuthStore } from '@/lib/ws/staff';
import { listWorkshops, type WorkshopWithOrg } from '@/lib/ws/workshops';
import { DashboardActivity } from './DashboardActivity';
import { DashboardNextSessions } from './DashboardNextSessions';
import { DashboardOnboarding } from './DashboardOnboarding';
import { DashboardWorkshops } from './DashboardWorkshops';
import styles from './dash.module.css';

interface Data {
  /** null = the query failed. Never treated as "empty", or a hiccup would show the welcome guide. */
  workshops: WorkshopWithOrg[] | null;
  sessions: SessionWithWorkshop[];
  events: EventWithWorkshop[];
  orgs: number | null;
}

/** One failing table must not blank the dashboard: each source settles on its own. */
const settle = async <T,>(p: Promise<T>, fallback: T): Promise<T> => {
  try {
    return await p;
  } catch {
    return fallback;
  }
};

async function loadData(): Promise<Data> {
  const [workshops, sessions, events, orgs] = await Promise.all([
    settle<WorkshopWithOrg[] | null>(listWorkshops(), null), settle(listWeekSessions(), []),
    settle(listRecentEvents(), []), settle<number | null>(countOrganizations(), null),
  ]);
  return { workshops, sessions, events, orgs };
}

export function DashboardSections() {
  const { whoami } = useStore(wsAuthStore);
  const [data, setData] = useState<Data | null>(null);

  useEffect(() => {
    let alive = true;
    void loadData().then((d) => { if (alive) setData(d); });
    return () => { alive = false; };
  }, []);

  if (data === null) return <div className="row"><Spinner /></div>;

  if (data.workshops === null) {
    return <div className="hud" style={{ padding: 18 }}>הטעינה נכשלה. רעננו את הדף.</div>;
  }

  if (data.orgs !== null && isNewInstall({ orgs: data.orgs, workshops: data.workshops.length })) {
    return isAdmin(whoami)
      ? <DashboardOnboarding />
      : <EmptyState icon={Calendar01Icon} title="אין סדנאות משויכות" text="כשתשויכו לסדנה היא תופיע כאן." />;
  }

  return (
    <div className={styles.stack}>
      <DashboardWorkshops workshops={myWorkshops(data.workshops)} />
      <div className={styles.two}>
        <DashboardNextSessions sessions={data.sessions} />
        <DashboardActivity events={data.events} />
      </div>
    </div>
  );
}
