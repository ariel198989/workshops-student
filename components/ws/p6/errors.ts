// Supabase errors arrive as Error subclasses or plain {code, message} objects; handle both.
const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;

export function errorCode(err: unknown): string | null {
  return isRecord(err) && typeof err.code === 'string' ? err.code : null;
}

function messageOf(err: unknown): string {
  return isRecord(err) && typeof err.message === 'string' ? err.message.trim() : '';
}

/** "<prefix>: <message>" when the error carries a message, else just the prefix. */
export function errText(prefix: string, err: unknown): string {
  const message = messageOf(err);
  return message ? `${prefix}: ${message}` : prefix;
}

/** Template screen errors: known Postgres codes get a Hebrew explanation. */
export function templateErrorText(err: unknown, fallback: string): string {
  switch (errorCode(err)) {
    case '23505': return 'כבר קיימת תבנית ברירת מחדל לפורמט הזה. הסירו אותה קודם מהתבנית הקיימת.';
    case '42501': return 'אין הרשאה לעריכת תבניות.';
    case '22023': return 'הרשימה אינה מעודכנת. רעננו את הדף ונסו שוב.';
    default: return errText(fallback, err);
  }
}
