import type { ReactNode } from 'react';

/** Public one-scan sign-in: no AuthGate, no student shell (AppFrame bypasses /g/*). */
export default function JoinLinkLayout({ children }: { children: ReactNode }) {
  return <div className="public-wrap" lang="he" dir="rtl">{children}</div>;
}
