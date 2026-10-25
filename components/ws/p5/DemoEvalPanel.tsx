'use client';
import { InlineEdit } from '../InlineEdit';
import { Pill } from '../StatusPill';
import type { PillTone } from '@/lib/ws/labels';
import type { DemoResult, WsDeliverable } from '@/lib/ws/types';
import { reviewSafe } from './api';
import { Field } from './Field';
import { DEMO_RESULT_LABELS, asText, toOptions } from './labels';
import { RubricForm } from './RubricForm';
import { buildRubricExtras, readRubricScores } from './rubric';

const RESULT_OPTIONS = toOptions(DEMO_RESULT_LABELS);
const RESULT_TONES: Record<DemoResult, PillTone> = { pass: 'green', partial: 'amber', fail: 'red' };
const isResult = (v: unknown): v is DemoResult => typeof v === 'string' && v in DEMO_RESULT_LABELS;

interface DemoEvalPanelProps {
  row: Pick<WsDeliverable, 'id' | 'demo_result' | 'demo_score' | 'demo_notes' | 'extras'>;
  disabled: boolean;
  onChanged: () => void;
}

/** Demo Day result, notes and the rubric. The rubric writes demo_score and extras.rubric together. */
export function DemoEvalPanel({ row, disabled, onChanged }: DemoEvalPanelProps) {
  const saved = readRubricScores(row.extras);
  const patch = async (p: Parameters<typeof reviewSafe>[1]) => {
    await reviewSafe(row.id, p);
    onChanged();
  };

  return (
    <div className="stack">
      <Field label="תוצאת הדגמה">
        <InlineEdit type="select" value={row.demo_result} options={RESULT_OPTIONS} disabled={disabled}
          ariaLabel="תוצאת הדגמה"
          display={(v) => (isResult(v) ? <Pill label={DEMO_RESULT_LABELS[v]} tone={RESULT_TONES[v]} /> : null)}
          onSave={(v) => (v === null ? patch({ demo_result: null }) : isResult(v) ? patch({ demo_result: v }) : undefined)} />
      </Field>
      <Field label="הערות">
        <InlineEdit type="textarea" value={row.demo_notes} disabled={disabled} ariaLabel="הערות הדגמה"
          onSave={(v) => patch({ demo_notes: asText(v) })} />
      </Field>
      <Field label="רובריקת Demo Day" wide>
        <RubricForm key={JSON.stringify(saved)} initial={saved} disabled={disabled}
          onSave={(scores, total) => patch({ demo_score: total, extras: buildRubricExtras(row.extras, scores) })} />
      </Field>
    </div>
  );
}
