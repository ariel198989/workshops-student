import type { Metadata } from 'next';
import { JoinLink } from '@/components/joinlink/JoinLink';
import { normalizeJoinToken } from '@/lib/student/join-token';

export const metadata: Metadata = {
  title: 'מתחברים לקבוצה · Corewise',
  description: 'סריקה אחת והטאבלט או הטלפון בתוך הקבוצה, בלי להקליד כלום.',
  robots: { index: false, follow: false },
};

interface JoinLinkPageProps {
  params: Promise<{ token: string }>;
}

export default async function JoinLinkPage({ params }: JoinLinkPageProps) {
  const { token } = await params;
  return <JoinLink token={normalizeJoinToken(token)} />;
}
