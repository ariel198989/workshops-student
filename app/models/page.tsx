import { PageHeader } from '@/components/ui/PageHeader';
import { ModelsTable } from '@/components/ws/p6/ModelsTable';

export default function ModelsPage() {
  return (
    <>
      <PageHeader title="מודלים ודאטה" subtitle="מודלים שאומנו על ידי קבוצות הסדנאות. לקריאה בלבד." />
      <ModelsTable />
    </>
  );
}
