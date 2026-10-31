import type { Metadata } from 'next';
import { TakeHome } from '@/components/takehome/TakeHome';

export const metadata: Metadata = {
  title: 'המודל שלנו · Corewise',
  description: 'המודל שהקבוצה אימנה בסדנה, רץ במצלמה של הטלפון. שום תמונה לא נשלחת לשום מקום.',
  robots: { index: false, follow: false },
};

interface TakeHomePageProps {
  params: Promise<{ token: string }>;
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export default async function TakeHomePage({ params }: TakeHomePageProps) {
  const { token } = await params;
  return <TakeHome token={safeDecode(token).trim().toLowerCase()} />;
}
