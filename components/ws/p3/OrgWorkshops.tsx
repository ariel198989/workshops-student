'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { WsWorkshop } from '@/lib/ws/types';
import { StatusPill } from '../StatusPill';
import { sortWorkshops } from './workshop-utils';
import styles from './p3.module.css';

interface OrgWorkshopsProps {
  orgId: string;
  workshops: readonly WsWorkshop[];
  canCreate: boolean;
}

export function OrgWorkshops({ orgId, workshops, canCreate }: OrgWorkshopsProps) {
  const router = useRouter();
  const newButton = canCreate ? (
    <button type="button" className="primary sm" onClick={() => router.push(`/workshops/new?org=${orgId}`)}>
      סדנה חדשה
    </button>
  ) : null;
  return (
    <section className={`hud ${styles.card}`}>
      <div className={styles.cardHead}>
        <h2>סדנאות של הארגון</h2>
        {workshops.length > 0 ? newButton : null}
      </div>
      {workshops.length === 0 ? (
        <div className="stack">
          <p className="hint">עדיין אין סדנאות לארגון הזה.</p>
          <div>{newButton}</div>
        </div>
      ) : (
        <ul className="stack" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {sortWorkshops(workshops).map((w) => (
            <li key={w.id} className="row">
              <Link className={styles.link} href={`/workshops/${w.id}/overview`}>{w.title}</Link>
              <span className={styles.code}>{w.code}</span>
              <StatusPill kind="workshop" value={w.status} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
