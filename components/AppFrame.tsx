'use client';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
import { decideRoute, isPublicPath, type RouteDecision } from '@/lib/shell-access';
import { useStore } from '@/lib/store';
import { wsAuthStore } from '@/lib/ws/staff';
import { Spinner } from '@/components/ui/Spinner';
import { AuthGate } from './AuthGate';
import { Shell } from './Shell';

const Loading = () => <div className="center-screen"><Spinner large /></div>;

/** Runs inside AuthGate (whoami is loaded): console for staff, student area for everyone else. */
function RouteGuard({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { whoami } = useStore(wsAuthStore);
  const decision: RouteDecision = decideRoute(whoami, pathname);
  const target = decision.kind === 'redirect' ? decision.to : null;

  useEffect(() => {
    if (target) router.replace(target);
  }, [target, router]);

  // 'student' pages bring their own chrome (app/student/layout.tsx); 'denied' is handled by AuthGate
  if (decision.kind === 'staff') return <Shell>{children}</Shell>;
  if (decision.kind === 'student') return <>{children}</>;
  return <Loading />;
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
