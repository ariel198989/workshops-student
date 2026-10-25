'use client';
import { removeAt, replaceAt, type Material } from './module-form';
import { MATERIAL_KINDS, MATERIAL_KIND_LABELS } from './labels';
import styles from './editor.module.css';

interface Props { items: readonly Material[]; onChange: (items: Material[]) => void }

export function MaterialsEditor({ items, onChange }: Props) {
  const patch = (i: number, p: Partial<Material>) => onChange(replaceAt(items, i, { ...items[i], ...p }));
  return (
    <div className={styles.group}>
      {items.map((m, i) => (
        <div key={i} className={styles.matRow}>
          <input type="text" value={m.label} placeholder="שם הפריט" aria-label={`פריט ${i + 1}`}
            onChange={(e) => patch(i, { label: e.target.value })} />
          <select value={m.kind} aria-label="סוג פריט" onChange={(e) => patch(i, { kind: e.target.value })}>
            {MATERIAL_KINDS.map((k) => <option key={k} value={k}>{MATERIAL_KIND_LABELS[k]}</option>)}
          </select>
          <button type="button" className="ghost sm" onClick={() => onChange(removeAt(items, i))}>הסרה</button>
        </div>
      ))}
      <div>
        <button type="button" className="sm" onClick={() => onChange([...items, { label: '', kind: 'handout' }])}>
          הוסיפו פריט
        </button>
      </div>
    </div>
  );
}
