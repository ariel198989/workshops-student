// Pure parsers for the Hebrew facilitator-guide text stored in ws_modules.
// facilitator_notes holds sections delimited by "── X ──"; summary holds the "סדר יום:" chip list.

export interface NoteSection { title: string | null; lines: string[] }
export interface AgendaRow { minutes: number; title: string; text: string }
export interface AgendaChip { title: string; minutes: number | null }

const MARKER = /^\s*──\s*(.+?)\s*──\s*$/;
const AGENDA_LINE = /^\s*[•*-]?\s*(\d+)\s*ד[׳']\s*·\s*(.+)$/;
const SUMMARY_PREFIX = /^\s*סדר יום\s*:\s*/;
const CHIP = /^(.*?)\s*\((\d+)\s*ד[׳']\)\s*$/;
const STEP_NUMBER = /^\s*\d+\s*[.)]\s*/;
const MAX_LABEL = 24;

/** Splits notes on the ── X ── markers. Blank lines are dropped; sections without a body disappear. */
export function parseNotes(text: string | null | undefined): NoteSection[] {
  if (!text) return [];
  const sections: NoteSection[] = [];
  let current: NoteSection = { title: null, lines: [] };
  const flush = () => {
    if (current.lines.length > 0) sections.push(current);
  };
  for (const raw of text.split(/\r?\n/)) {
    const marker = MARKER.exec(raw);
    if (marker) {
      flush();
      current = { title: marker[1], lines: [] };
    } else if (raw.trim()) {
      current = { ...current, lines: [...current.lines, raw.trim()] };
    }
  }
  flush();
  return sections;
}

/** "• 10 ד׳ · כותרת — תיאור" into parts, or null when the line is not an agenda row. */
export function parseAgendaLine(line: string): AgendaRow | null {
  const m = AGENDA_LINE.exec(line);
  if (!m) return null;
  const [head, ...rest] = m[2].split(' — ');
  return { minutes: Number(m[1]), title: head.trim(), text: rest.join(' — ').trim() };
}

/** "תווית: ערך" with a short label, or null (long prefixes are sentences, not labels). */
export function splitLabel(line: string): { label: string; value: string } | null {
  const m = /^([^:]+):\s*(.+)$/.exec(line);
  if (!m || m[1].length > MAX_LABEL) return null;
  return { label: m[1].trim(), value: m[2].trim() };
}

/** Chips from the summary "סדר יום: א (10 ד׳) · ב (5 ד׳)". Free text yields [] so callers can show a paragraph. */
export function parseAgenda(summary: string | null | undefined): AgendaChip[] {
  if (!summary || !SUMMARY_PREFIX.test(summary)) return [];
  return summary.replace(SUMMARY_PREFIX, '').split(' · ').map((part) => {
    const m = CHIP.exec(part.trim());
    return m ? { title: m[1].trim(), minutes: Number(m[2]) } : { title: part.trim(), minutes: null };
  }).filter((c) => c.title.length > 0);
}

/** Numbered exercise instructions into plain step strings. */
export function instructionSteps(instructions: string | null | undefined): string[] {
  return (instructions ?? '').split(/\r?\n/).map((l) => l.replace(STEP_NUMBER, '').trim()).filter(Boolean);
}
