'use client';
import { CvGate } from '@/components/student/cv/CvGate';
import { TagScreen } from '@/components/student/cv/TagScreen';

export default function TagPage() {
  return <CvGate>{(session) => <TagScreen session={session} />}</CvGate>;
}
