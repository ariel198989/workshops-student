import { HugeiconsIcon, type IconSvgElement } from '@hugeicons/react';
import { Spinner } from './Spinner';

interface KpiTileProps {
  label: string;
  /** null while loading, undefined when the query failed */
  value: number | null | undefined;
  icon: IconSvgElement;
  note?: string;
  tone?: 'cyan' | 'gold';
}

const numberFmt = new Intl.NumberFormat('he-IL');

function renderValue(value: KpiTileProps['value']) {
  if (value === null) return <Spinner label="טוען" />;
  if (value === undefined) return <span title="שגיאה בטעינה">—</span>;
  return numberFmt.format(value);
}

export function KpiTile({ label, value, icon, note, tone = 'cyan' }: KpiTileProps) {
  return (
    <div className={tone === 'gold' ? 'hud kpi gold' : 'hud kpi'}>
      <div className="kpi-top">
        <span className="kpi-label">{label}</span>
        <HugeiconsIcon icon={icon} size={18} />
      </div>
      <div className="kpi-value">{renderValue(value)}</div>
      {note ? <div className="kpi-note">{note}</div> : null}
    </div>
  );
}
