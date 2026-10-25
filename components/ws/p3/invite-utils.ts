// Pure request parsing for POST /api/staff/invite (kept out of the route so it is unit tested).
export type InviteRole = 'admin' | 'instructor' | 'guest';
export interface InviteRequest { email: string; role: InviteRole; full_name: string | undefined }
export type InviteParse = { ok: true; value: InviteRequest } | { ok: false; error: string };

const ROLES: readonly string[] = ['admin', 'instructor', 'guest'];
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const EMAIL_MAX = 254;
const NAME_MAX = 120;

export function bearerToken(header: string | null | undefined): string | null {
  const m = /^Bearer\s+(\S+)\s*$/i.exec(header ?? '');
  return m ? m[1] : null;
}

export function parseInviteBody(raw: unknown): InviteParse {
  if (raw === null || typeof raw !== 'object') return { ok: false, error: 'invalid body' };
  const { email, role, full_name } = raw as Record<string, unknown>;
  const mail = typeof email === 'string' ? email.trim().toLowerCase() : '';
  if (!mail || mail.length > EMAIL_MAX || !EMAIL.test(mail)) return { ok: false, error: 'invalid email' };
  if (typeof role !== 'string' || !ROLES.includes(role)) return { ok: false, error: 'invalid role' };
  const name = typeof full_name === 'string' ? full_name.trim() : '';
  if (name.length > NAME_MAX) return { ok: false, error: 'name too long' };
  return { ok: true, value: { email: mail, role: role as InviteRole, full_name: name || undefined } };
}
