'use client';
import { CvGate } from '@/components/student/cv/CvGate';
import { ResultsScreen } from '@/components/student/cv/ResultsScreen';

export default function ResultsPage() {
  return <CvGate>{(session) => <ResultsScreen session={session} />}</CvGate>;
}
