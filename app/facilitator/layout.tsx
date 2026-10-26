import type { ReactNode } from 'react';
import { FacilitatorGate } from '@/components/facilitator/FacilitatorGate';

// Staff-only, no student shell. Relies on AppFrame treating /facilitator as a
// public path (lib/student/access.ts isPublicPath) so this gate is the only one.
export default function FacilitatorLayout({ children }: { children: ReactNode }) {
  return <FacilitatorGate>{children}</FacilitatorGate>;
}
