// Small display formatters shared by the P4 screens.

const DATE = new Intl.DateTimeFormat('he-IL', { day: 'numeric', month: 'numeric' });
const DATE_TIME = new Intl.DateTimeFormat('he-IL', { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' });
const TIME = new Intl.DateTimeFormat('he-IL', { hour: '2-digit', minute: '2-digit' });

function parse(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

export const formatShortDate = (iso: string | null | undefined): string | null => {
  const d = parse(iso);
  return d ? DATE.format(d) : null;
};

export const formatDateTime = (iso: string | null | undefined): string | null => {
  const d = parse(iso);
  return d ? DATE_TIME.format(d) : null;
};

export const formatTime = (iso: string | null | undefined): string | null => {
  const d = parse(iso);
  return d ? TIME.format(d) : null;
};
