'use client';
import { useParams } from 'next/navigation';
import { PackageIcon } from '@hugeicons/core-free-icons';
import { EmptyState } from '@/components/ui/EmptyState';
import { Spinner } from '@/components/ui/Spinner';
import { DeliverableCard } from '@/components/ws/p5/DeliverableCard';
import { useLoad } from '@/components/ws/p5/useLoad';
import { usePerm } from '@/components/ws/p5/usePerm';
import styles from '@/components/ws/p5/p5.module.css';
import { listDeliverables } from '@/lib/ws/deliverables';

export default function DeliverablesPage() {
  const { id } = useParams<{ id: string }>();
  const { editable } = usePerm(id);
  const { data, error, loading, reload } = useLoad(() => listDeliverables(id), [id]);

  if (loading && !data) return <div className={styles.center}><Spinner large /></div>;
  if (error || !data) return <p className="err" role="alert">{error ?? 'הטעינה נכשלה'}</p>;
  if (data.length === 0) {
    return (
      <EmptyState icon={PackageIcon} title="אין עדיין תוצרים"
        text="הרשומות נוצרות אוטומטית כשהסדנה עוברת ל-live." />
    );
  }
  return (
    <div className={styles.page}>
      {data.map((row) => <DeliverableCard key={row.id} row={row} editable={editable} onChanged={reload} />)}
    </div>
  );
}
