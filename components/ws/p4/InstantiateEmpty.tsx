'use client';
import { useState } from 'react';
import { Calendar01Icon } from '@hugeicons/core-free-icons';
import { EmptyState } from '@/components/ui/EmptyState';
import { toast } from '@/lib/store';
import { instantiateCurriculum } from '@/lib/ws/curriculum';
import { errorText } from './hooks';

interface InstantiateEmptyProps {
  workshopId: string;
  canEdit: boolean;
  onDone: () => void;
}

/** Shown on overview and sessions when the workshop has no meetings yet. */
export function InstantiateEmpty({ workshopId, canEdit, onDone }: InstantiateEmptyProps) {
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setBusy(true);
    try {
      await instantiateCurriculum(workshopId);
      toast('תוכנית הלימודים נטענה', true);
      onDone();
    } catch (err) {
      toast(errorText(err, 'טעינת התוכנית נכשלה'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <EmptyState
      icon={Calendar01Icon}
      title="אין מפגשים עדיין"
      text={canEdit ? 'טענו את תוכנית הלימודים של הסדנה כדי ליצור את המפגשים והמודולים.' : 'המדריך עדיין לא טען תוכנית לימודים.'}
      actions={canEdit ? (
        <button type="button" className="primary" onClick={() => void load()} disabled={busy}>
          {busy ? 'טוען' : 'טען תוכנית לימודים'}
        </button>
      ) : undefined}
    />
  );
}
