import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { StudentShell } from '@/components/student/shell/StudentShell';

export const metadata: Metadata = {
  title: 'Workshops OS · האזור שלי',
  description: 'צילום, תיוג ואימון מודל ראייה ממוחשבת עם הקבוצה שלכם',
};

export const viewport: Viewport = {
  themeColor: '#FFFFFF',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

/** AuthGate and the route guard in AppFrame have already run; this adds the student chrome. */
export default function StudentLayout({ children }: { children: ReactNode }) {
  return <StudentShell>{children}</StudentShell>;
}
