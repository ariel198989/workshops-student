import { DashboardKpis } from '@/components/DashboardKpis';
import { PageHeader } from '@/components/ui/PageHeader';
import { DashboardSections } from '@/components/ws/p6/DashboardSections';

export default function DashboardPage() {
  return (
    <>
      <PageHeader title="לוח בקרה" subtitle="תמונת מצב כללית של הסדנאות, המודלים והאימונים." />
      <DashboardKpis />
      <DashboardSections />
    </>
  );
}
