// Pure value conversion for InlineEdit (no React, unit tested).

export type InlineType = 'text' | 'textarea' | 'select' | 'date' | 'datetime' | 'number';
export type InlineValue = string | number | null;
export type ParseResult = { readonly ok: true; readonly value: InlineValue } | { readonly ok: false };

const pad = (n: number): string => String(n).padStart(2, '0');

/** Stored value -> the string an <input> expects. datetime uses the browser's local time. */
export function toInputValue(type: InlineType, value: InlineValue): string {
  if (value === null || value === undefined) return '';
  if (type === 'date') return String(value).slice(0, 10);
  if (type === 'datetime') {
    const d = new Date(String(value));
    if (Number.isNaN(d.getTime())) return '';
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
  return String(value);
}

/** Raw input string -> value to save. Empty input saves null. */
export function parseInlineValue(type: InlineType, raw: string): ParseResult {
  const text = raw.trim();
  if (text === '') return { ok: true, value: null };
  if (type === 'number') {
    const n = Number(text);
    return Number.isFinite(n) ? { ok: true, value: n } : { ok: false };
  }
  if (type === 'datetime') {
    const d = new Date(text);
    return Number.isNaN(d.getTime()) ? { ok: false } : { ok: true, value: d.toISOString() };
  }
  return { ok: true, value: text };
}

export const sameValue = (a: InlineValue, b: InlineValue): boolean => a === b;
