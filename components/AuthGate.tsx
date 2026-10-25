'use client';
import { useEffect, type ReactNode } from 'react';
import { authStore, initAuth, logout } from '@/lib/auth';
import { useStore } from '@/lib/store';
import { resetStudentContext } from '@/lib/student/context';
import { whoami as fetchWhoami, wsAuthStore } from '@/lib/ws/staff';
import { Spinner } from '@/components/ui/Spinner';
import { AuthCard } from '@/components/student/shell/AuthCard';

function NoAccess({ email }: { email?: string }) {
  return (
    <div className="center-screen">
      <div className="hud denied">
        <h1>לא הצלחנו לטעון את החשבון</h1>
        <p className="muted">
          לא הצלחנו לבדוק את ההרשאות של <span dir="ltr" className="ink">{email}</span>. רעננו את הדף או התנתקו ונסו שוב.
        </p>
        <div className="page-actions">
          <button className="primary" onClick={() => location.reload()}>רענון</button>
          <button onClick={() => void logout()}>התנתקות</button>
        </div>
      </div>
    </div>
  );
}

/**
 * Signed out: login / student sign up. Signed in: waits for ws_whoami, then renders children.
 * Who sees what (staff console, student area, join flow) is decided by the route guard in AppFrame.
 */
export function AuthGate({ children }: { children: ReactNode }) {
  const { user, loaded } = useStore(authStore);
  const { whoami, loaded: whoamiLoaded } = useStore(wsAuthStore);
  const userId = user?.id;
  useEffect(() => {
    void initAuth();
  }, []);
  useEffect(() => {
    resetStudentContext();
    if (!userId) {
      wsAuthStore.set({ whoami: null, loaded: false });
      return;
    }
    // canonical ws_whoami, once per signed-in user; any failure fails closed to the error screen
    let current = true;
    fetchWhoami()
      .then((w) => { if (current) wsAuthStore.set({ whoami: w, loaded: true }); })
      .catch(() => { if (current) wsAuthStore.set({ whoami: null, loaded: true }); });
    return () => { current = false; };
  }, [userId]);

  if (!loaded || (user && !whoamiLoaded)) {
    return <div className="center-screen"><Spinner large /></div>;
  }
  if (!user) return <AuthCard />;
  if (!whoami) return <NoAccess email={user.email} />;
  return <>{children}</>;
}
