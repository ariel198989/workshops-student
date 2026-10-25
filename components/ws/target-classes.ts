import { normalizeTargetClasses } from '../../lib/ws/workshops';

export const TARGET_CLASSES_HINT = '2-3 אובייקטים מומלץ';
export const RECOMMENDED_MAX_CLASSES = 3;

/** Pasted/typed text may hold several values separated by commas or newlines. */
export function addTargetClasses(current: readonly string[], raw: string): string[] {
  const parts = raw.split(/[,\n\r]+/);
  return normalizeTargetClasses([...current, ...parts]);
}

export function removeTargetClass(current: readonly string[], index: number): string[] {
  return current.filter((_, i) => i !== index);
}

export const isOverRecommended = (value: readonly string[]): boolean => value.length > RECOMMENDED_MAX_CLASSES;
