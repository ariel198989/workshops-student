'use client';
import type { ReactNode } from 'react';
import { Drawer } from '@/components/ws/Drawer';
import { StatusPill } from '@/components/ws/StatusPill';
import type { WsSessionModule } from '@/lib/ws/types';
import { exerciseSteps, materialLabel, parseNotes, textList } from './notes';
import styles from './flow.module.css';

// Hebrew names for the curriculum tool_hook ids; 'none' shows no chip.
const HOOK_LABELS: Record<string, string> = {
  series_capture: 'צילום סדרות',
  phone_tagger: 'סימון בטלפון',
  cloud_train: 'אימון בענן',
  live_cam: 'מצלמה חיה',
  pocket_trainer: 'מאמן כיס',
  map: 'מפה',
  presentation: 'מצגת',
};

const text = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');
const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className={styles.dBlock}>
      <h3>{title}</h3>
      {children}
    </section>
  );
}

function Exercises({ items }: { items: unknown }) {
  const list = Array.isArray(items) ? items.filter(isRecord) : [];
  if (list.length === 0) return null;
  return (
    <Block title="תרגילים">
      {list.map((ex, i) => {
        const hook = text(ex.tool_hook);
        const steps = exerciseSteps(ex);
        return (
          <div key={i} className={styles.exercise}>
            <div className={styles.exHead}>
              <strong>{text(ex.title) || `תרגיל ${i + 1}`}</strong>
              {hook && HOOK_LABELS[hook] ? <span className={styles.hook}>{HOOK_LABELS[hook]}</span> : null}
            </div>
            {steps.length > 0 ? <ol>{steps.map((s, j) => <li key={j}>{s}</li>)}</ol> : null}
          </div>
        );
      })}
    </Block>
  );
}

function Notes({ value }: { value: string }) {
  const sections = parseNotes(value);
  if (sections.length === 0) return null;
  return (
    <Block title="הערות למנחה">
      {sections.map((s, i) => (
        <div key={i}>
          {s.heading ? <h4 className={styles.noteHead}>{s.heading}</h4> : null}
          {s.lines.map((line, j) => <p key={j} className={styles.noteLine}>{line}</p>)}
        </div>
      ))}
    </Block>
  );
}

interface ModuleDrawerProps {
  module: WsSessionModule | null;
  onClose: () => void;
}

/** Read-only view of the content snapshot frozen into the session module at instantiate time. */
export function ModuleDrawer({ module, onClose }: ModuleDrawerProps) {
  const c = module?.content ?? {};
  const summary = text(c.summary);
  const objectives = textList(c.objectives);
  const materials = (Array.isArray(c.materials) ? c.materials : []).flatMap((m) => materialLabel(m) ?? []);
  const notes = text(c.facilitator_notes);
  const templateNotes = text(c.template_notes);
  return (
    <Drawer open={module !== null} title={module?.title ?? ''} onClose={onClose} width="520px">
      {module ? (
        <>
          <div className={styles.dBlock}>
            <StatusPill kind="module" value={module.status} />
            <span className={styles.modMeta}> {module.duration_minutes} דקות</span>
          </div>
          {summary ? <Block title="תקציר"><p className={styles.lines}>{summary}</p></Block> : null}
          {objectives.length > 0 ? <Block title="מטרות"><ul>{objectives.map((o, i) => <li key={i}>{o}</li>)}</ul></Block> : null}
          <Exercises items={c.exercises} />
          {materials.length > 0 ? <Block title="חומרים"><ul>{materials.map((m, i) => <li key={i}>{m}</li>)}</ul></Block> : null}
          {templateNotes ? <Block title="הערת תבנית"><p className={styles.lines}>{templateNotes}</p></Block> : null}
          <Notes value={notes} />
          {!summary && objectives.length === 0 && !notes ? <p className="hint">אין תוכן שמור למודול הזה.</p> : null}
        </>
      ) : null}
    </Drawer>
  );
}
