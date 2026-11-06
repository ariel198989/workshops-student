'use client';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { MergeTrainer } from '@/components/facilitator/MergeTrainer';
import { Spinner } from '@/components/ui/Spinner';
import { useStore } from '@/lib/store';
import { isStaffOfWorkshop, MERGE_BAD_LINK, MERGE_NO_GROUP, MERGE_NOT_STAFF, parseMergeParams } from '@/lib/facilitator/merge';
import { fetchMergeGroup, type MergeGroup } from '@/lib/facilitator/merge-api';
import { wsAuthStore } from '@/lib/ws/staff';
import m from '@/components/facilitator/merge.module.css';

function Notice({ title, text }: { title: string; text: string }) {
  return (
    <div className={m.notice} role="alert">
      <h1>{title}</h1>
      <p>{text}</p>
      <Link href="/facilitator" role="button">למצב מדריך</Link>
    </div>
  );
}

/** Reached from the console's group card. FacilitatorGate (layout) already required a staff login. */
function MergeRoute() {
  const params = useSearchParams();
  const target = parseMergeParams(params.get('w'), params.get('g'));
  const { whoami } = useStore(wsAuthStore);
  const allowed = !!target && isStaffOfWorkshop(whoami, target.workshopId);
  const [group, setGroup] = useState<MergeGroup | null | undefined>(undefined);
  const [failed, setFailed] = useState(false);
  const wid = target?.workshopId;
  const gid = target?.groupId;

  useEffect(() => {
    if (!allowed || !wid || !gid) return;
    let alive = true;
    setGroup(undefined);
    setFailed(false);
    fetchMergeGroup({ workshopId: wid, groupId: gid })
      .then((g) => { if (alive) setGroup(g); })
      .catch(() => { if (alive) { setFailed(true); setGroup(null); } });
    return () => { alive = false; };
  }, [allowed, wid, gid]);

  if (!target) return <Notice title="קישור לא תקין" text={MERGE_BAD_LINK} />;
  if (!allowed || !whoami?.user_id) return <Notice title="אין הרשאה" text={MERGE_NOT_STAFF} />;
  if (group === undefined) return <Spinner large />;
  if (!group) return <Notice title="הקבוצה לא נמצאה" text={failed ? 'לא הצלחנו לטעון את הקבוצה. בדקו את החיבור ורעננו.' : MERGE_NO_GROUP} />;
  return <MergeTrainer group={group} staffUserId={whoami.user_id} />;
}

export default function MergePage() {
  return (
    <main className={m.page}>
      <Suspense fallback={<Spinner large />}>
        <MergeRoute />
      </Suspense>
    </main>
  );
}
