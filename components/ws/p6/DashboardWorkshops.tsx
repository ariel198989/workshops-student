import Link from 'next/link';
import type { WorkshopWithOrg } from '@/lib/ws/workshops';
import { StatusPill } from '../StatusPill';
import { formatDay } from './format';
import styles from './dash.module.css';

const ORG_FALLBACK = '';

function LiveWorkshop({ workshop: w }: { workshop: WorkshopWithOrg }) {
  return (
    <div className={styles.live}>
      <div className={styles.liveInfo}>
        <div><StatusPill kind="workshop" value="live" /></div>
        <div className={styles.liveTitle}>{w.title}</div>
        <div className={styles.liveMeta}>{w.organization?.name ?? ORG_FALLBACK}</div>
      </div>
      <Link href={`/workshops/${w.id}/groups`} className={styles.liveLink}>כניסה ללוח הקבוצות</Link>
    </div>
  );
}

function UpcomingRow({ workshop: w }: { workshop: WorkshopWithOrg }) {
  return (
    <li className={styles.row}>
      <div className={styles.rowMain}>
        <span className={styles.rowTitle}><Link href={`/workshops/${w.id}/overview`}>{w.title}</Link></span>
        <span className={styles.rowSub}>{w.organization?.name ?? ORG_FALLBACK}</span>
      </div>
      <StatusPill kind="workshop" value={w.status} />
      <span className={styles.rowEnd}>{formatDay(w.starts_on)}</span>
    </li>
  );
}

/** "הסדנאות שלי": live workshops first with a direct link to the groups tab, then upcoming ones. */
export function DashboardWorkshops({ workshops }: { workshops: readonly WorkshopWithOrg[] }) {
  const live = workshops.filter((w) => w.status === 'live');
  const upcoming = workshops.filter((w) => w.status !== 'live');
  return (
    <section className={styles.section} aria-labelledby="dash-workshops">
      <div className={styles.sectionHead}>
        <h2 id="dash-workshops" className={styles.sectionTitle}>הסדנאות שלי</h2>
        <Link href="/workshops" className={styles.more}>כל הסדנאות</Link>
      </div>
      {live.map((w) => <LiveWorkshop key={w.id} workshop={w} />)}
      {upcoming.length > 0 ? (
        <ul className={`hud ${styles.list} ${styles.panel}`}>
          {upcoming.map((w) => <UpcomingRow key={w.id} workshop={w} />)}
        </ul>
      ) : null}
      {workshops.length === 0 ? <div className={`hud ${styles.panelEmpty}`}>אין סדנאות פעילות או קרובות.</div> : null}
    </section>
  );
}
