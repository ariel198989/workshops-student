'use client';
import { useCallback, useEffect, useState } from 'react';
import { LockIcon, UserMultiple02Icon } from '@hugeicons/core-free-icons';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { Spinner } from '@/components/ui/Spinner';
import { StaffAddPanel } from '@/components/ws/p3/StaffAddPanel';
import { StaffTable } from '@/components/ws/p3/StaffTable';
import { toast, useStore } from '@/lib/store';
import { isAdmin, listStaff, wsAuthStore } from '@/lib/ws/staff';
import type { WsStaff } from '@/lib/ws/types';

export default function Page() {
  const { whoami, loaded } = useStore(wsAuthStore);
  const admin = isAdmin(whoami);
  const [rows, setRows] = useState<WsStaff[] | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    try {
      setRows(await listStaff());
    } catch {
      setFailed(true);
      toast('טעינת רשימת הצוות נכשלה');
    }
  }, []);

  useEffect(() => { if (admin) void load(); }, [admin, load]);

  const replace = useCallback((row: WsStaff) => {
    setRows((prev) => (prev ? prev.map((r) => (r.user_id === row.user_id ? row : r)) : prev));
  }, []);

  if (!loaded) return <Spinner large />;
  if (!admin) {
    return <EmptyState icon={LockIcon} title="הדף זמין למנהלים בלבד" text="פנו לבעלים או למנהל כדי לנהל את צוות הפלטפורמה." />;
  }
  return (
    <>
      <PageHeader title="צוות" subtitle="אנשי הצוות של הפלטפורמה והתפקידים שלהם." />
      <div className="stack">
        <StaffAddPanel onAdded={() => void load()} />
        {failed ? (
          <EmptyState icon={UserMultiple02Icon} title="הרשימה לא נטענה" text="רעננו את הדף ונסו שוב." />
        ) : rows === null ? (
          <Spinner large />
        ) : (
          <StaffTable rows={rows} viewerRole={whoami?.staff?.role ?? null} viewerId={whoami?.user_id ?? null} onChanged={replace} />
        )}
      </div>
    </>
  );
}
