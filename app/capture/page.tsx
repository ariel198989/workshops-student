'use client';
import { Suspense, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { CaptureScreen } from '@/components/student/cv/CaptureScreen';
import { CvGate } from '@/components/student/cv/CvGate';
import { startFaceGuard } from '@/lib/cv/face-detector';

function CaptureRoute() {
  const preset = useSearchParams().get('cls');
  return <CvGate>{(session) => <CaptureScreen session={session} presetClass={preset} />}</CvGate>;
}

export default function CapturePage() {
  // the privacy guard gates the shutter: start its download before the context and the camera
  useEffect(() => { startFaceGuard(); }, []);
  return (
    <Suspense fallback={null}>
      <CaptureRoute />
    </Suspense>
  );
}
