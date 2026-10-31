'use client';
// One anon RPC for the take-home page. Nothing on that page writes anywhere.
import { sb } from '../db';
import { normalizeShared, type SharedGroup } from './shared-model';

export async function fetchSharedModel(token: string): Promise<SharedGroup | null> {
  const { data, error } = await sb.rpc('ws_shared_model', { p_token: token });
  if (error) throw new Error(error.message);
  return normalizeShared(data);
}
