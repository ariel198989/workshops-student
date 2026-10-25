'use client';
import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { CaptureScreen } from '@/components/student/cv/CaptureScreen';
import { CvGate } from '@/components/student/cv/CvGate';

function CaptureRoute() {
  const preset = useSearchParams().get('cls');
  return <CvGate>{(session) => <CaptureScreen session={session} presetClass={preset} />}</CvGate>;
}

export default function CapturePage() {
  return (
    <Suspense fallback={null}>
      <CaptureRoute />
    </Suspense>
  );
}
