'use client';
import { useStore } from '@/lib/store';
import { canEdit, isAdmin, wsAuthStore } from '@/lib/ws/staff';

export interface Perm { editable: boolean; admin: boolean }

/** Mirrors the RLS helpers on the client; the DB stays the authority. */
export function usePerm(workshopId: string): Perm {
  const { whoami } = useStore(wsAuthStore);
  return { editable: canEdit(whoami, workshopId), admin: isAdmin(whoami) };
}
