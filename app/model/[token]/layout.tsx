import type { ReactNode } from 'react';

/** Public take-home page: no AuthGate, no student shell (AppFrame bypasses /model/*). */
export default function TakeHomeLayout({ children }: { children: ReactNode }) {
  return <div className="public-wrap" lang="he" dir="rtl">{children}</div>;
}
