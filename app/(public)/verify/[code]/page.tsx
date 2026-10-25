import type { Metadata } from 'next';
import { VerifyResult } from '@/components/ws/p5/VerifyResult';

export const metadata: Metadata = {
  title: 'אימות תעודה · Corewise',
  robots: { index: false, follow: false },
};

interface VerifyPageProps {
  params: Promise<{ code: string }>;
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export default async function VerifyPage({ params }: VerifyPageProps) {
  const { code } = await params;
  return <VerifyResult code={safeDecode(code).trim().toLowerCase()} />;
}
