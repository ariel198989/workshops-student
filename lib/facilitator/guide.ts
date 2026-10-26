// המפגש: pure helpers for the facilitator's session guide. No React, no
// Supabase; everything here is testable with node --test.

export interface SessionRow {
  id: string;
  workshop_id: string;
  session_no: number;
  title: string | null;
  kind: string | null;
  scheduled_at: string | null;
  duration_minutes: number | null;
  status: string | null;
}

export interface Question { q: string; options: string[]; answer: string; core?: boolean }
export interface Exercise {
  title: string;
  instructions: string;
  kind: string | null;
  tool_hook: string | null;
  questions?: Question[];
}
export interface Material { label: string; kind: string | null }
export interface ModuleContent {
  summary?: string | null;
  objectives?: string[] | null;
  exercises?: Exercise[] | null;
  materials?: Material[] | null;
  facilitator_notes?: string | null;
  template_notes?: string | null;
}
export interface ModuleRow {
  id: string;
  session_id: string;
  workshop_id: string;
  position: number;
  title: string | null;
  module_type: string | null;
  duration_minutes: number | null;
  pipeline_stage: string | null;
  content: ModuleContent | null;
}

export interface AgendaItem { minutes: number | null; title: string; text: string }
export interface ParsedNotes {
  notes: string;
  agenda: AgendaItem[];
  assessment: string;
  adaptations: { easier: string; harder: string; raw: string };
}

export const STAGE_HE: Record<string, string> = {
  intro: 'פתיחה', problem: 'הבעיה', research: 'מחקר', collect: 'איסוף דאטה', label: 'תיוג', train: 'אימון',
  evaluate: 'הערכה', demo: 'הדגמה', present: 'הצגה', deploy: 'הטמעה', reflect: 'רפלקציה', wrap: 'סיכום',
};
export const TYPE_HE: Record<string, string> = {
  demo: 'הדגמה', practice: 'תרגול', theory: 'תיאוריה', assessment: 'הערכה', discussion: 'דיון', game: 'משחק',
  project: 'פרויקט', presentation: 'הצגה', reflection: 'רפלקציה', break: 'הפסקה', lecture: 'הרצאה',
};
export const KIND_HE: Record<string, string> = {
  group: 'בקבוצות', pair: 'בזוגות', individual: 'יחידני', class: 'כל הכיתה', demo: 'הדגמה', discussion: 'דיון',
  quiz: 'שאלון', homework: 'שיעורי בית', game: 'משחק',
};
export const SESSION_KIND_HE: Record<string, string> = { regular: 'רגיל', practical: 'מעשי', online: 'מקוון', exam: 'מבחן' };

export const he = (map: Record<string, string>, key: string | null | undefined): string | null =>
  key ? (map[key] ?? key) : null;

const FINISHED = new Set(['done', 'completed', 'cancelled', 'canceled']);
const SECTION_RE = /^\s*[─—–-]{2,}\s*(.+?)\s*[─—–-]{2,}\s*$/;
const SECTION_KEYS: Record<string, 'agenda' | 'assessment' | 'adaptations'> = {
  'סדר יום': 'agenda', 'הערכה': 'assessment', 'התאמות': 'adaptations',
};
// "• 8 ד׳ · הלקוח מציג — text" / "- text" / "– text"; minutes and text both optional
const AGENDA_RE = /^\s*[•·\-*]?\s*(?:(\d+)\s*(?:דק(?:ות)?|ד|min)['׳’]?\s*[·:.]?\s*)?(.*)$/u;
const SEP_RE = /\s+[—–-]\s+/;

function splitSections(notes: string): { free: string; sections: Record<string, string> } {
  const freeLines: string[] = [];
  const sections: Record<string, string[]> = {};
  let current: string | null = null;
  for (const line of notes.split(/\r?\n/)) {
    const m = SECTION_RE.exec(line);
    if (m) {
      current = SECTION_KEYS[m[1].trim()] ?? m[1].trim();
      sections[current] = sections[current] ?? [];
      continue;
    }
    if (current) sections[current].push(line);
    else freeLines.push(line);
  }
  const joined: Record<string, string> = {};
  for (const [k, v] of Object.entries(sections)) joined[k] = v.join('\n').trim();
  return { free: freeLines.join('\n').trim(), sections: joined };
}

export function parseAgendaLine(line: string): AgendaItem | null {
  const trimmed = line.trim();
  if (!trimmed) return null;
  const m = AGENDA_RE.exec(trimmed);
  if (!m) return null;
  const minutes = m[1] ? Number(m[1]) : null;
  const rest = m[2].trim();
  if (!rest && minutes === null) return null;
  const sep = SEP_RE.exec(rest);
  if (!sep || sep.index === undefined) return { minutes, title: rest, text: '' };
  return { minutes, title: rest.slice(0, sep.index).trim(), text: rest.slice(sep.index + sep[0].length).trim() };
}

export function parseAgenda(block: string): AgendaItem[] {
  return block.split(/\r?\n/).map(parseAgendaLine).filter((x): x is AgendaItem => x !== null);
}

const labelled = (block: string, label: string): string => {
  const line = block.split(/\r?\n/).find((l) => l.trim().startsWith(label));
  return line ? line.trim().slice(label.length).replace(/^\s*:\s*/, '').trim() : '';
};

export function parseNotes(notes: string | null | undefined): ParsedNotes {
  const { free, sections } = splitSections(notes ?? '');
  const adapt = sections.adaptations ?? '';
  return {
    notes: free,
    agenda: parseAgenda(sections.agenda ?? ''),
    assessment: sections.assessment ?? '',
    adaptations: { easier: labelled(adapt, 'קל יותר'), harder: labelled(adapt, 'מאתגר יותר'), raw: adapt },
  };
}

/** "1. do this\n2. then that" -> ['do this', 'then that']; unnumbered lines are kept as steps too. */
export function parseSteps(instructions: string | null | undefined): string[] {
  return (instructions ?? '').split(/\r?\n/)
    .map((l) => l.replace(/^\s*(?:\d+[.)]|[-•*])\s*/, '').trim())
    .filter((l) => l.length > 0);
}

const sameLocalDay = (a: Date, b: Date): boolean =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

const when = (s: SessionRow): Date | null => {
  if (!s.scheduled_at) return null;
  const d = new Date(s.scheduled_at);
  return Number.isNaN(d.getTime()) ? null : d;
};

export const isFinished = (s: SessionRow): boolean => FINISHED.has((s.status ?? '').toLowerCase());

/** Today's open session, else the earliest upcoming open one, else the first open one, else the first. */
export function pickDefaultSession(sessions: readonly SessionRow[], now: Date = new Date()): SessionRow | null {
  if (sessions.length === 0) return null;
  const open = sessions.filter((s) => !isFinished(s));
  const today = open.find((s) => { const d = when(s); return d !== null && sameLocalDay(d, now); });
  if (today) return today;
  const upcoming = open
    .map((s) => ({ s, d: when(s) }))
    .filter((x): x is { s: SessionRow; d: Date } => x.d !== null && x.d.getTime() >= now.getTime())
    .sort((a, b) => a.d.getTime() - b.d.getTime());
  if (upcoming.length > 0) return upcoming[0].s;
  return open[0] ?? sessions[0];
}

export const sessionTotal = (modules: readonly Pick<ModuleRow, 'duration_minutes'>[]): number =>
  modules.reduce((n, m) => n + (m.duration_minutes ?? 0), 0);

export const agendaTotal = (items: readonly AgendaItem[]): number =>
  items.reduce((n, a) => n + (a.minutes ?? 0), 0);

export const minutesHe = (n: number): string => `${n} ד׳`;

/** "25.10" style short date in the device locale; empty when the ISO is missing or bad. */
export function fmtShortDate(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('he-IL', { day: 'numeric', month: 'numeric' }).format(d);
}

export function fmtTime(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('he-IL', { hour: '2-digit', minute: '2-digit' }).format(d);
}

/** Session chip: ״מפגש 1 · אני המודל · 45 ד׳״ */
export function sessionChipLabel(s: SessionRow, total: number): string {
  const parts = [`מפגש ${s.session_no}`];
  if (s.title) parts.push(s.title);
  const mins = total > 0 ? total : (s.duration_minutes ?? 0);
  if (mins > 0) parts.push(minutesHe(mins));
  return parts.join(' · ');
}

export interface SafeContent {
  summary: string;
  objectives: string[];
  exercises: Exercise[];
  materials: Material[];
  facilitator_notes: string;
  template_notes: string;
}

/** Content arrives as jsonb; a row written by hand may be missing keys or have the wrong shape. */
export function safeContent(c: unknown): SafeContent {
  const o = (c && typeof c === 'object' ? c : {}) as ModuleContent;
  const str = (v: unknown): string => (typeof v === 'string' ? v : '');
  const strs = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);
  const exercises: Exercise[] = Array.isArray(o.exercises)
    ? o.exercises.filter((e): e is Exercise => !!e && typeof e === 'object').map((e) => ({
      title: str(e.title), instructions: str(e.instructions), kind: e.kind ?? null, tool_hook: e.tool_hook ?? null,
      questions: Array.isArray(e.questions)
        ? e.questions.filter((q): q is Question => !!q && typeof q === 'object' && typeof q.q === 'string')
          .map((q) => ({ q: q.q, options: strs(q.options), answer: str(q.answer), core: q.core === true }))
        : undefined,
    }))
    : [];
  const materials: Material[] = Array.isArray(o.materials)
    ? o.materials.filter((m): m is Material => !!m && typeof m === 'object' && typeof m.label === 'string')
      .map((m) => ({ label: m.label, kind: m.kind ?? null }))
    : [];
  return {
    summary: str(o.summary), objectives: strs(o.objectives), exercises, materials,
    facilitator_notes: str(o.facilitator_notes), template_notes: str(o.template_notes),
  };
}

/** Modules grouped by session, keeping the incoming (position) order. */
export function groupModules(modules: readonly ModuleRow[]): Record<string, ModuleRow[]> {
  const out: Record<string, ModuleRow[]> = {};
  for (const m of modules) out[m.session_id] = [...(out[m.session_id] ?? []), m];
  return out;
}

/** mm:ss for the countdown; never negative. */
export function fmtClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const mm = Math.floor(s / 60);
  const ss = s % 60;
  return `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
}
