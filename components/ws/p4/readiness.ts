// Pure readiness math for the groups board (no React, unit tested).
// Tiers mirror ws_internal_group_stats: red < 50 tagged, ok 50-149, strong 150+.

export type Tier = 'red' | 'ok' | 'strong';

export const RED_BELOW = 50;
export const STRONG_FROM = 150;
/** the bar is full at this many tagged photos */
export const BAR_MAX = 200;

export function readinessTier(tagged: number): Tier {
  if (!Number.isFinite(tagged) || tagged < RED_BELOW) return 'red';
  return tagged < STRONG_FROM ? 'ok' : 'strong';
}

/** 0..100, linear up to BAR_MAX */
export function barPercent(tagged: number): number {
  if (!Number.isFinite(tagged) || tagged <= 0) return 0;
  return Math.min(100, (tagged / BAR_MAX) * 100);
}

export const TICK_PERCENTS: readonly number[] = [barPercent(RED_BELOW), barPercent(STRONG_FROM)];

const TIER_LABELS: Record<Tier, string> = {
  red: 'חסרות תמונות',
  ok: 'בדרך',
  strong: 'מוכנה לאימון',
};

export const tierLabel = (tier: Tier): string => TIER_LABELS[tier];

/** sc_models.accuracy is mAP50 in 0..1; tolerate values already in percent. */
export function formatAccuracy(accuracy: number | null): string | null {
  if (accuracy === null || !Number.isFinite(accuracy)) return null;
  const pct = accuracy <= 1 ? accuracy * 100 : accuracy;
  return `${Math.round(pct)}%`;
}
