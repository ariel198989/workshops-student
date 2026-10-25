'use client';
import { LockIcon } from '@hugeicons/core-free-icons';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { Spinner } from '@/components/ui/Spinner';
import { NewWorkshopForm } from '@/components/ws/p3/NewWorkshopForm';
import { useStore } from '@/lib/store';
import { isAdmin, wsAuthStore } from '@/lib/ws/staff';

export default function Page() {
  const { whoami, loaded } = useStore(wsAuthStore);
  if (!loaded) return <Spinner large />;
  if (!isAdmin(whoami)) {
    return <EmptyState icon={LockIcon} title="יצירת סדנה זמינה למנהלים בלבד" text="פנו לבעלים או למנהל כדי לפתוח סדנה חדשה." />;
  }
  return (
    <>
      <PageHeader title="סדנה חדשה" subtitle="ארגון, קוד וקידומת קבוצות. התבנית נטענת אוטומטית לפי הפורמט." />
      <NewWorkshopForm />
    </>
  );
}
