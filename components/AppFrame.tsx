'use client';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { decideAccess, isPublicPath } from '@/lib/student/access';
import { useStore } from '@/lib/store';
import { wsAuthStore } from '@/lib/ws/staff';
import { Spinner } from '@/components/ui/Spinner';
import { StudentShell } from '@/components/student/shell/StudentShell';
import { AuthGate } from './AuthGate';
import { StaffNotice } from './StaffNotice';

/** Runs inside AuthGate (whoami is loaded): student shell, join redirect, or the staff notice. */
function RouteGuard({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { whoami } = useStore(wsAuthStore);
  const [previewing, setPreviewing] = useState(false);
  const decision = decideAccess(whoami, pathname, previewing);
  const target = decision.kind === 'redirect' ? decision.to : null;

  useEffect(() => {
    if (target) router.replace(target);
  }, [target, router]);

  if (decision.kind === 'student') return <StudentShell>{children}</StudentShell>;
  if (decision.kind === 'staff-notice') return <StaffNotice onPreview={() => setPreviewing(true)} />;
  return <div className="center-screen"><Spinner large /></div>;
}

/** Wraps the app in AuthGate + RouteGuard; public routes (/verify/*) render bare. */
export function AppFrame({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  if (isPublicPath(pathname)) return <>{children}</>;
  return (
    <AuthGate>
      <RouteGuard>{children}</RouteGuard>
    </AuthGate>
  );
}
