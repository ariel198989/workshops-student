'use client';
import Link from 'next/link';
import { listEvents, eventLabel } from '@/lib/ws/events';
import { fetchOverview } from '@/lib/ws/workshops';
import type { Overview, WsEvent } from '@/lib/ws/types';
import { InstantiateEmpty } from '@/components/ws/p4/InstantiateEmpty';
import { LoadGate } from '@/components/ws/p4/LoadGate';
import { SessionTimeline } from '@/components/ws/p4/SessionTimeline';
import { formatDateTime, formatTime } from '@/components/ws/p4/format';
import { useCanEdit, useLoader, useWorkshopId } from '@/components/ws/p4/hooks';
import styles from '@/components/ws/p4/flow.module.css';

interface OverviewData { overview: Overview; events: WsEvent[] }

const EVENT_LIMIT = 20;
const numberFmt = new Intl.NumberFormat('he-IL');

async function loadAll(id: string): Promise<OverviewData> {
  // the feed is secondary: a failing events query must not hide the overview
  const [overview, events] = await Promise.all([fetchOverview(id), listEvents(id, EVENT_LIMIT).catch(() => [])]);
  return { overview, events };
}

function StatRow({ totals }: { totals: Overview['totals'] }) {
  const items = [
    { label: 'קבוצות', value: totals.groups },
    { label: 'משתתפים בקבוצות', value: totals.members },
    { label: 'תמונות', value: totals.photos },
    { label: 'מתויגות', value: totals.tagged },
    { label: 'קבוצות עם מודל', value: totals.groups_with_model },
  ];
  return (
    <ul className={styles.stats} aria-label="סיכום">
      {items.map((i) => (
        <li key={i.label} className={styles.stat}>
          <span className={styles.statValue}>{numberFmt.format(i.value)}</span>
          <span className={styles.statLabel}>{i.label}</span>
        </li>
      ))}
    </ul>
  );
}

function Feed({ events }: { events: readonly WsEvent[] }) {
  if (events.length === 0) return <p className={`hud ${styles.feedEmpty}`}>עדיין אין פעילות.</p>;
  return (
    <ul className={styles.feed}>
      {events.map((e) => (
        <li key={e.id}>
          <span>{eventLabel(e)}</span>
          <time className={styles.feedTime} dateTime={e.created_at}>{formatDateTime(e.created_at)}</time>
        </li>
      ))}
    </ul>
  );
}

export default function OverviewPage() {
  const id = useWorkshopId();
  const canEdit = useCanEdit(id);
  const { data, error, loading, reload } = useLoader(() => loadAll(id), id);
  const overview = data?.overview;

  return (
    <LoadGate loading={loading} error={error} hasData={!!data} onRetry={() => void reload()}>
      {overview && data ? (
        <>
          <div className={styles.bar}>
            <h2>סקירה</h2>
            <div className={styles.barEnd}>
              <span className={styles.stamp}>עודכן ב-{formatTime(overview.generated_at)}</span>
              <button type="button" className="sm" onClick={() => void reload()}>רענון</button>
            </div>
          </div>

          <StatRow totals={overview.totals} />

          {overview.unassigned_participants > 0 ? (
            <div className={styles.warn} role="status">
              <span>{overview.unassigned_participants} משתתפים עדיין בלי קבוצה.</span>
              <Link href={`/workshops/${id}/participants`}>למשתתפים</Link>
            </div>
          ) : null}

          <section className={styles.section}>
            <h3>מפגשים</h3>
            {overview.sessions.length === 0
              ? <InstantiateEmpty workshopId={id} canEdit={canEdit} onDone={() => void reload()} />
              : <SessionTimeline workshopId={id} sessions={overview.sessions} />}
          </section>

          <section className={styles.section}>
            <h3>פעילות אחרונה</h3>
            <Feed events={data.events} />
          </section>
        </>
      ) : null}
    </LoadGate>
  );
}
