'use client';
import { sb } from './db';
import { createStore } from './store';

export interface AuthState {
  user: { id: string; email?: string } | null;
  loaded: boolean;
}

export const authStore = createStore<AuthState>({ user: null, loaded: false });

export async function initAuth() {
  try {
    const { data: { session } } = await sb.auth.getSession();
    authStore.set({ user: session?.user ?? null, loaded: true });
  } catch {
    authStore.set({ loaded: true });
  }
}

export async function login(email: string, pass: string) {
  const r = await sb.auth.signInWithPassword({ email, password: pass });
  if (r.error) throw r.error;
  await initAuth();
}

export async function logout() {
  await sb.auth.signOut();
  location.reload();
}
