'use client';
// Door for /facilitator. The picker and /facilitator/free are open to anyone and
// make no database calls; a real workshop id goes through the staff login
// (AuthGate variant="staff") and then the ws_whoami staff check.
import Link from 'next/link';
import { useSelectedLayoutSegment } from 'next/navigation';
import type { ReactNode } from 'react';
import { AuthGate } from '@/components/AuthGate';
import { logout } from '@/lib/auth';
import { useStore } from '@/lib/store';
import { facilitatorGateMode } from '@/lib/student/access';
import { wsAuthStore } from '@/lib/ws/staff';

function StaffOnly({ children }: { children: ReactNode }) {
  const { whoami } = useStore(wsAuthStore);
  if (whoami?.staff) return <>{children}</>;
  return (
    <main className="center-screen">
      <div className="hud denied">
        <h1>הסדנה פתוחה לצוות בלבד</h1>
        <p className="muted">החשבון הזה הוא של תלמיד. אפשר לעבוד במצב חופשי, לחזור לאפליקציית התלמידים או להתחבר עם חשבון צוות.</p>
        <div className="page-actions">
          <Link href="/facilitator/free" className="primary" role="button">למצב חופשי</Link>
          <Link href="/" role="button">לאפליקציית התלמידים</Link>
          <button type="button" onClick={() => void logout()}>התנתקות</button>
        </div>
      </div>
    </main>
  );
}

export function FacilitatorGate({ children }: { children: ReactNode }) {
  const segment = useSelectedLayoutSegment();
  if (facilitatorGateMode(segment) === 'open') return <>{children}</>;
  return (
    <AuthGate variant="staff">
      <StaffOnly>{children}</StaffOnly>
    </AuthGate>
  );
}
