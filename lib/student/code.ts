// Workshop join codes look like OFEK-H2-27: letters, digits, single hyphens.
const DASHES = /[‐-―−־]/g;
const ALLOWED = /[^A-Z0-9-]/g;
const MIN_CODE_CHARS = 4;

/**
 * Uppercases, unifies typographic dashes, turns whitespace into hyphens ("OFEK H2 27"
 * typed from a whiteboard becomes OFEK-H2-27) and drops anything a code cannot contain.
 */
export function normalizeCode(raw: string | null | undefined): string {
  if (!raw) return '';
  return raw
    .replace(DASHES, '-')
    .replace(/\s+/g, '-')
    .toUpperCase()
    .replace(ALLOWED, '')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function isCodeComplete(code: string): boolean {
  return code.replace(/-/g, '').length >= MIN_CODE_CHARS;
}
