import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { SB_KEY, SB_URL } from '@/lib/config';
import { dbErrorMessage } from '@/components/ws/p3/db-errors';
import { bearerToken, parseInviteBody } from '@/components/ws/p3/invite-utils';
import type { Whoami } from '@/lib/ws/types';

// The service key is read here and nowhere else; it never reaches a client bundle.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ADMIN_ROLES: readonly string[] = ['owner', 'admin'];
const NO_SESSION = { auth: { persistSession: false, autoRefreshToken: false } } as const;
const reply = (body: Record<string, unknown>, status: number) => NextResponse.json(body, { status });

// auth.admin.inviteUserByEmail fails for an address that already has an account; that is fine, we just add it as staff
const ALREADY_REGISTERED = /already (been )?registered|email_exists|already exists/i;

export async function POST(req: Request): Promise<NextResponse> {
  const authorization = req.headers.get('authorization');
  if (!bearerToken(authorization)) return reply({ error: 'unauthorized' }, 401);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return reply({ error: 'invalid body' }, 400);
  }
  const parsed = parseInviteBody(body);
  if (!parsed.ok) return reply({ error: parsed.error }, 400);
  const { email, role, full_name } = parsed.value;

  // everything below the check runs as the caller: RLS and ws_add_staff stay the authority
  const caller = createClient(SB_URL, SB_KEY, { ...NO_SESSION, global: { headers: { Authorization: authorization as string } } });
  const who = await caller.rpc('ws_whoami');
  if (who.error || !who.data) return reply({ error: 'unauthorized' }, 401);
  const staffRole = (who.data as Whoami).staff?.role;
  if (!staffRole || !ADMIN_ROLES.includes(staffRole)) return reply({ error: 'forbidden' }, 403);

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) return reply({ error: 'service key not configured' }, 501);

  const admin = createClient(SB_URL, serviceKey, NO_SESSION);
  const invited = await admin.auth.admin.inviteUserByEmail(email, { data: full_name ? { full_name } : undefined });
  if (invited.error && !ALREADY_REGISTERED.test(`${invited.error.code ?? ''} ${invited.error.message}`)) {
    return reply({ error: 'invite failed' }, 502);
  }

  const added = await caller.rpc('ws_add_staff', { p_email: email, p_role: role, p_full_name: full_name ?? null });
  if (added.error) return reply({ error: dbErrorMessage(added.error, 'ההוספה לצוות נכשלה') }, 400);
  return reply({ user_id: added.data as string }, 200);
}
