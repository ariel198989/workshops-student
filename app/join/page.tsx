import { Suspense } from 'react';
import { JoinFlow } from '@/components/student/shell/JoinFlow';

/** JoinFlow reads ?code= with useSearchParams, so it renders inside Suspense. */
export default function StudentJoinPage() {
  return (
    <Suspense fallback={null}>
      <JoinFlow />
    </Suspense>
  );
}
