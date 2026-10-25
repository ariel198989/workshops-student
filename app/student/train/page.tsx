'use client';
import { CvGate } from '@/components/student/cv/CvGate';
import { TrainScreen } from '@/components/student/cv/TrainScreen';

export default function TrainPage() {
  return <CvGate>{(session) => <TrainScreen session={session} />}</CvGate>;
}
