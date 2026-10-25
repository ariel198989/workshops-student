// Pure helpers for the groups and participants screens (no React, unit tested).

const MAX_GROUPS = 40;

/** Same default as ws_create_groups: ceil(audience / group size), kept inside the RPC range 1..40. */
export function defaultGroupCount(audienceSize: number | null, groupSize: number): number {
  if (!audienceSize || audienceSize < 1 || groupSize < 1) return 1;
  return Math.min(MAX_GROUPS, Math.max(1, Math.ceil(audienceSize / groupSize)));
}

/** Roster textarea: one name per line, trimmed, blank lines dropped, case-insensitive dedupe. */
export function parseRoster(text: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const line of text.split(/\r?\n/)) {
    const name = line.trim();
    const key = name.toLowerCase();
    if (!name || seen.has(key)) continue;
    seen.add(key);
    out.push(name);
  }
  return out;
}

export const hasInactiveGroups = (groups: readonly { activated: boolean }[]): boolean =>
  groups.some((g) => !g.activated);
