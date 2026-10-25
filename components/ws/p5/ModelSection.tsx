'use client';
import { useState } from 'react';
import { Drawer } from '../Drawer';
import { Spinner } from '@/components/ui/Spinner';
import { fetchTeamModels } from '@/lib/ws/deliverables';
import { toast } from '@/lib/store';
import type { CityModel } from '@/lib/types';
import type { WsDeliverable } from '@/lib/ws/types';
import { patchDeliverable } from './api';
import { ModelPicker, isPersonalModel } from './ModelPicker';
import { PhotoGallery } from './PhotoGallery';
import { formatAccuracy } from './snapshot';
import { useLoad } from './useLoad';
import styles from './p5.module.css';

interface ModelSectionProps {
  row: Pick<WsDeliverable, 'id' | 'model_id' | 'locked_at'>;
  team: string;
  disabled: boolean;
  onChanged: () => void;
}

/** Final model choice plus the group's photo gallery; both open in drawers. */
export function ModelSection({ row, team, disabled, onChanged }: ModelSectionProps) {
  const [drawer, setDrawer] = useState<'models' | 'photos' | null>(null);
  const { data: models, error, loading } = useLoad(() => fetchTeamModels(team), [team]);
  const current = models?.find((m) => m.id === row.model_id) ?? null;

  const pick = async (m: CityModel) => {
    try {
      await patchDeliverable(row.id, { model_id: m.id });
      setDrawer(null);
      onChanged();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'בחירת המודל נכשלה');
    }
  };

  return (
    <div className="stack">
      {loading && !models ? <Spinner /> : null}
      {error ? <p className="err" role="alert">{error}</p> : null}
      {current ? (
        <p dir="auto">
          <span className="ink">{current.name}</span>{' '}
          <span className="hint">
            דיוק {formatAccuracy(current.accuracy)}{current.approved ? ', מאושר' : ''}{isPersonalModel(current) ? ', אישי' : ''}
          </span>
        </p>
      ) : (
        <p className="hint">{row.model_id ? 'המודל שנבחר לא נמצא ברשימה.' : 'לא נבחר מודל. בנעילה ייבחר המודל הטוב ביותר.'}</p>
      )}
      <div className={styles.metaRow}>
        <button type="button" className="sm" onClick={() => setDrawer('models')}>
          {disabled ? 'מודלים של הקבוצה' : 'בחירת מודל'} {models ? `(${models.length})` : ''}
        </button>
        <button type="button" className="sm" onClick={() => setDrawer('photos')}>גלריית תמונות</button>
      </div>
      <Drawer open={drawer === 'models'} title="מודלים של הקבוצה" width="680px" onClose={() => setDrawer(null)}>
        <ModelPicker models={models ?? []} selectedId={row.model_id} disabled={disabled} onPick={(m) => void pick(m)} />
      </Drawer>
      <Drawer open={drawer === 'photos'} title="תמונות הקבוצה" width="680px" onClose={() => setDrawer(null)}>
        <PhotoGallery team={team} />
      </Drawer>
    </div>
  );
}
