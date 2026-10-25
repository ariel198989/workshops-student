import { sb } from '../db';
import { createStore } from '../store';
import type { Whoami } from './types';

export async function whoami(): Promise<Whoami> {
  const { data, error } = await sb.rpc('ws_whoami');
  if (error) throw error;
  return data as Whoami;
}

export const wsAuthStore = createStore<{ whoami: Whoami | null; loaded: boolean }>({ whoami: null, loaded: false });
