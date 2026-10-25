// Small Hebrew date/time formatters for the dashboard. Pure; `now` is injectable for tests.
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const LOCALE = 'he-IL';

const dayTime = new Intl.DateTimeFormat(LOCALE, { weekday: 'short', day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' });
const dayOnly = new Intl.DateTimeFormat(LOCALE, { day: 'numeric', month: 'numeric', year: '2-digit' });

export const formatSessionTime = (iso: string): string => dayTime.format(new Date(iso));

export const formatDay = (iso: string | null): string => (iso ? dayOnly.format(new Date(iso)) : '');

/** "עכשיו", "לפני 5 דק׳", "לפני 3 שע׳", "לפני 2 ימים", then a plain date. */
export function relativeTime(iso: string, now: Date = new Date()): string {
  const diff = now.getTime() - new Date(iso).getTime();
  if (!Number.isFinite(diff)) return '';
  if (diff < MINUTE) return 'עכשיו';
  if (diff < HOUR) return `לפני ${Math.floor(diff / MINUTE)} דק׳`;
  if (diff < DAY) return `לפני ${Math.floor(diff / HOUR)} שע׳`;
  if (diff < 7 * DAY) {
    const days = Math.floor(diff / DAY);
    return days === 1 ? 'אתמול' : `לפני ${days} ימים`;
  }
  return formatDay(iso);
}
