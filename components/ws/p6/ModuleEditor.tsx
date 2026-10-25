'use client';
import { useState, type ReactNode } from 'react';
import { saveModule } from '@/lib/ws/curriculum';
import { toast } from '@/lib/store';
import type { ModuleType, WsModule } from '@/lib/ws/types';
import { ExercisesEditor } from './ExercisesEditor';
import { ListEditor } from './ListEditor';
import { MaterialsEditor } from './MaterialsEditor';
import { MODULE_TYPE_LABELS, PIPELINE_STAGES, STAGE_LABELS } from './labels';
import { errText } from './errors';
import {
  draftFromModule, draftToInput, emptyDraft, validateDraft, DURATION_MAX, DURATION_MIN, TITLE_MAX,
  type ModuleDraft,
} from './module-form';
import styles from './editor.module.css';

interface Props {
  /** null = new module */
  initial: WsModule | null;
  onSaved: (saved: WsModule) => void;
  onCancel: () => void;
}

const MODULE_TYPES = Object.keys(MODULE_TYPE_LABELS) as ModuleType[];
const parseTags = (text: string): string[] => text.split(',').map((t) => t.trim()).filter(Boolean);

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className={styles.group}>
      <h3 className={styles.groupTitle}>{title}</h3>
      {children}
    </section>
  );
}

export function ModuleEditor({ initial, onSaved, onCancel }: Props) {
  const [draft, setDraft] = useState<ModuleDraft>(() => (initial ? draftFromModule(initial) : emptyDraft()));
  const [tagsText, setTagsText] = useState(() => draft.tags.join(', '));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (p: Partial<ModuleDraft>) => setDraft((d) => ({ ...d, ...p }));

  const save = async () => {
    const problem = validateDraft(draft);
    setError(problem);
    if (problem) return;
    setBusy(true);
    try {
      const saved = await saveModule(draftToInput(draft, initial?.id));
      toast(`נשמר, גרסה ${saved.version}`, true);
      onSaved(saved);
    } catch (err) {
      toast(errText('השמירה נכשלה', err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className={styles.form} onSubmit={(e) => { e.preventDefault(); void save(); }}>
      <Group title="פרטים">
        <div className={styles.grid4}>
          <label>
            <span className="lbl">כותרת</span>
            <input type="text" value={draft.title} maxLength={TITLE_MAX} onChange={(e) => set({ title: e.target.value })} />
          </label>
          <label>
            <span className="lbl">סוג</span>
            <select value={draft.module_type} onChange={(e) => set({ module_type: e.target.value as ModuleType })}>
              {MODULE_TYPES.map((t) => <option key={t} value={t}>{MODULE_TYPE_LABELS[t]}</option>)}
            </select>
          </label>
          <label>
            <span className="lbl">שלב</span>
            <select value={draft.pipeline_stage} onChange={(e) => set({ pipeline_stage: e.target.value })}>
              <option value="">ללא שלב</option>
              {PIPELINE_STAGES.map((s) => <option key={s} value={s}>{STAGE_LABELS[s]}</option>)}
            </select>
          </label>
          <label>
            <span className="lbl">משך (דקות)</span>
            <input type="number" min={DURATION_MIN} max={DURATION_MAX} value={Number.isFinite(draft.duration_minutes) ? draft.duration_minutes : ''}
              onChange={(e) => set({ duration_minutes: e.target.value === '' ? Number.NaN : Number(e.target.value) })} />
          </label>
        </div>
        <label>
          <span className="lbl">תקציר</span>
          <textarea className={styles.textarea} value={draft.summary} onChange={(e) => set({ summary: e.target.value })} />
        </label>
        <label className={styles.checkRow}>
          <input type="checkbox" checked={draft.requires_app} onChange={(e) => set({ requires_app: e.target.checked })} />
          דורש אפליקציה
        </label>
      </Group>

      <Group title="מטרות">
        <ListEditor items={draft.objectives} onChange={(objectives) => set({ objectives })}
          addLabel="הוסיפו מטרה" placeholder="מטרה אחת, בקצרה" ariaLabel="מטרה" />
      </Group>
      <Group title="תרגילים">
        <ExercisesEditor items={draft.exercises} onChange={(exercises) => set({ exercises })} />
      </Group>
      <Group title="חומרים וציוד">
        <MaterialsEditor items={draft.materials} onChange={(materials) => set({ materials })} />
      </Group>
      <Group title="הערות למנחה">
        <textarea className={styles.notesArea} value={draft.facilitator_notes} aria-label="הערות למנחה"
          placeholder={'── סדר יום ──\n• 10 ד׳ · כותרת\n\n── הערכה ──\nראיות: ...'}
          onChange={(e) => set({ facilitator_notes: e.target.value })} />
        <span className="hint">שורת ── כותרת ── פותחת אזור חדש בתצוגת המנחה.</span>
      </Group>
      <Group title="תגיות">
        <input type="text" dir="ltr" value={tagsText} aria-label="תגיות" placeholder="audience:school, core, pixels"
          onChange={(e) => { setTagsText(e.target.value); set({ tags: parseTags(e.target.value) }); }} />
      </Group>

      <div className={styles.bar}>
        <button type="submit" className="primary" disabled={busy}>{busy ? 'שומר' : 'שמירה'}</button>
        <button type="button" className="ghost" disabled={busy} onClick={onCancel}>ביטול</button>
        {error ? <span className={styles.barErr} role="alert">{error}</span> : null}
        <span className={styles.barSpacer} />
        {initial ? <span className="hint">גרסה {initial.version}</span> : null}
      </div>
    </form>
  );
}
