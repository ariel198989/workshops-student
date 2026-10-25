// Pure helpers that read the module content snapshot (no React, unit tested).

export interface NoteSection { readonly heading: string | null; readonly lines: string[] }

const HEADING = /^[─—-]{2,}\s*(.+?)\s*[─—-]{2,}$/;

/** Splits facilitator_notes on "── title ──" markers; empty lines and empty sections are dropped. */
export function parseNotes(text: string | null | undefined): NoteSection[] {
  if (!text) return [];
  const sections: NoteSection[] = [];
  let current: { heading: string | null; lines: string[] } = { heading: null, lines: [] };
  const flush = () => {
    if (current.lines.length > 0) sections.push(current);
  };
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    const match = HEADING.exec(line);
    if (match) {
      flush();
      current = { heading: match[1], lines: [] };
    } else if (line) {
      current.lines.push(line);
    }
  }
  flush();
  return sections;
}

/** Only non-empty strings, trimmed. */
export function textList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((v) => (typeof v === 'string' && v.trim() ? [v.trim()] : []));
}

/** Exercise steps from `steps[]`, falling back to a newline-joined `instructions` string. */
export function exerciseSteps(exercise: Record<string, unknown>): string[] {
  const steps = textList(exercise.steps);
  if (steps.length > 0) return steps;
  const text = exercise.instructions;
  return typeof text === 'string' ? text.split(/\r?\n/).map((s) => s.trim()).filter(Boolean) : [];
}

/** Materials are plain strings or {label} / {title} objects. */
export function materialLabel(material: unknown): string | null {
  if (typeof material === 'string') return material.trim() || null;
  if (typeof material !== 'object' || material === null) return null;
  const m = material as Record<string, unknown>;
  for (const key of ['label', 'title', 'name']) {
    const v = m[key];
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return null;
}
