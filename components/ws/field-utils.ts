import type { FieldType, JsonObject, WsFieldDefinition } from '../../lib/ws/types';

export interface FieldOption { readonly value: string; readonly label: string }
export type RendererKind = 'input' | 'number' | 'date' | 'checkbox' | 'select' | 'chips' | 'url';

/** One renderer per ws_field_definitions.field_type; Record makes tsc fail on a new type. */
export const FIELD_RENDERERS: Record<FieldType, RendererKind> = {
  text: 'input', number: 'number', date: 'date', boolean: 'checkbox',
  select: 'select', multiselect: 'chips', url: 'url',
};

/** options is jsonb: either ["a","b"] or [{value,label}]. Anything else is skipped. */
export function optionList(options: readonly unknown[]): FieldOption[] {
  const out: FieldOption[] = [];
  for (const o of options) {
    if (typeof o === 'string') out.push({ value: o, label: o });
    else if (o && typeof o === 'object' && typeof (o as { value?: unknown }).value === 'string') {
      const { value, label } = o as { value: string; label?: unknown };
      out.push({ value, label: typeof label === 'string' ? label : value });
    }
  }
  return out;
}

const isEmpty = (v: unknown): boolean =>
  v === undefined || v === null || (typeof v === 'string' && v.trim() === '') || (Array.isArray(v) && v.length === 0);

function isHttpUrl(v: string): boolean {
  try {
    const u = new URL(v);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

function typeError(def: WsFieldDefinition, v: unknown): string | null {
  if (def.field_type === 'number' && (typeof v !== 'number' || !Number.isFinite(v))) return 'יש להזין מספר';
  if (def.field_type === 'url' && (typeof v !== 'string' || !isHttpUrl(v.trim()))) return 'יש להזין כתובת תקינה';
  return null;
}

/** key -> Hebrew error. A required boolean only needs a defined value (false is an answer). */
export function validateCustomFields(defs: readonly WsFieldDefinition[], value: JsonObject): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const def of defs) {
    const v = value[def.key];
    if (def.field_type === 'boolean') {
      if (def.required && typeof v !== 'boolean') errors[def.key] = 'שדה חובה';
      continue;
    }
    if (isEmpty(v)) {
      if (def.required) errors[def.key] = 'שדה חובה';
      continue;
    }
    const bad = typeError(def, v);
    if (bad) errors[def.key] = bad;
  }
  return errors;
}

/** Immutable update; empty values remove the key so jsonb stays clean. */
export function setField(value: JsonObject, key: string, next: unknown): JsonObject {
  const { [key]: _removed, ...rest } = value;
  return isEmpty(next) ? rest : { ...rest, [key]: next };
}
