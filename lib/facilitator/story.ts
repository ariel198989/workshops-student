// The curriculum template's story frame (ws_curriculum_templates.story) and the 3-minute opener of
// one session, for the top of the facilitator's המפגש step. Pure, no imports: unit tested under Node.

export interface StoryOpener {
  /** the story's hero, one line, shown once above the opener */
  hero: string | null;
  /** what happens in the story in this session */
  beat: string | null;
  /** the 3-minute text the facilitator reads or retells */
  opener: string;
  materials: string | null;
}

const text = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);

/**
 * The opener of session `sessionNo`, or null when the template has no story, the story has no entry
 * for that session, or the entry has no opener text. Anything malformed is treated as missing.
 */
export function openerFor(story: unknown, sessionNo: number | null | undefined): StoryOpener | null {
  if (!story || typeof story !== 'object' || sessionNo == null) return null;
  const st = story as { hero_he?: unknown; sessions?: unknown };
  if (!Array.isArray(st.sessions)) return null;
  const entry = st.sessions.find((s): s is Record<string, unknown> =>
    !!s && typeof s === 'object' && Number((s as Record<string, unknown>).session_no) === sessionNo);
  const opener = text(entry?.opener_he);
  if (!entry || !opener) return null;
  return { hero: text(st.hero_he), beat: text(entry.beat_he), opener, materials: text(entry.materials_he) };
}

export const OPENER_TITLE = 'פתיח של 3 דקות';
