import type { ReactNode } from 'react';

/** Public group: no AuthGate, no Shell (AppFrame bypasses /verify/*). */
export default function VerifyLayout({ children }: { children: ReactNode }) {
  return <div className="public-wrap">{children}</div>;
}
