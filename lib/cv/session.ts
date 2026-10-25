'use client';
import { sb } from '../db';

/** The signed-in Supabase user id (local session read, no network round trip). */
export async function getUserId(): Promise<string> {
  const { data, error } = await sb.auth.getSession();
  const id = data.session?.user.id;
  if (error || !id) throw new Error('צריך להתחבר מחדש כדי להמשיך.');
  return id;
}
