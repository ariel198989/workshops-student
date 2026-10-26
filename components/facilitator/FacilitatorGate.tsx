'use client';
// Staff-only door for /facilitator: sign-in via the shared AuthGate, then the
// ws_whoami staff check. No student shell, no /join redirect.
import Link from 'next/link';
import type { ReactNode } from 'react';
import { AuthGate } from '@/components/AuthGate';
import { logout } from '@/lib/auth';
import { useStore } from '@/lib/store';
import { wsAuthStore } from '@/lib/ws/staff';

function StaffOnly({ children }: { children: ReactNode }) {
  const { whoami } = useStore(wsAuthStore);
  if (whoami?.staff) return <>{children}</>;
  return (
    <div className="center-screen">
      <div className="hud denied">
        <h1>מצב מדריך פתוח לצוות בלבד</h1>
        <p className="muted">החשבון הזה הוא של תלמיד. חזרו לאפליקציית התלמידים או התחברו עם חשבון צוות.</p>
        <div className="page-actions">
          <Link href="/" className="primary" role="button">לאפליקציית התלמידים</Link>
          <button type="button" onClick={() => void logout()}>התנתקות</button>
        </div>
      </div>
    </div>
  );
}

export function FacilitatorGate({ children }: { children: ReactNode }) {
  return (
    <AuthGate>
      <StaffOnly>{children}</StaffOnly>
    </AuthGate>
  );
}
