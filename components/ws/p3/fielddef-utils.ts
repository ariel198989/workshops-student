// Pure helpers for the field-definitions editor on /settings.
import type { FieldType } from '../../../lib/ws/types';

const KEY_PATTERN = /^[a-z][a-z0-9_]{1,39}$/;
export const KEY_RULE = 'מפתח: a-z, 0-9 וקו תחתון, 2 עד 40 תווים, מתחיל באות';
const MAX_OPTIONS = 50;

export const validateFieldKey = (key: string): string | null => (KEY_PATTERN.test(key) ? null : KEY_RULE);

export const needsOptions = (type: FieldType): boolean => type === 'select' || type === 'multiselect';

/** "א, ב" or one per line -> unique trimmed strings. */
export function parseOptions(text: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of text.split(/[,\n]/)) {
    const item = part.trim();
    if (item && !seen.has(item)) {
      seen.add(item);
      out.push(item);
    }
  }
  return out.slice(0, MAX_OPTIONS);
}

/** options is jsonb: strings or {value,label}. Anything else is skipped. */
export function optionsToText(options: readonly unknown[]): string {
  const items: string[] = [];
  for (const o of options) {
    if (typeof o === 'string') items.push(o);
    else if (o && typeof o === 'object' && typeof (o as { value?: unknown }).value === 'string') {
      items.push((o as { value: string }).value);
    }
  }
  return items.join(', ');
}
