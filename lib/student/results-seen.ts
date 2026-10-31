'use client';
// "The team has seen its results": the one stepper tick that is a visit, not a count. Kept per team on the device.
import { useEffect } from 'react';
import { createStore, useStore } from '../store';
import { localStorageOrNull } from './device-id';
import { readResultsSeen, writeResultsSeen } from './flow';

interface State { seen: Record<string, boolean> }

const seenStore = createStore<State>({ seen: {} });

/** Called by the results screen once a model is on screen. */
export function markResultsSeen(team: string): void {
  writeResultsSeen(localStorageOrNull(), team);
  const { seen } = seenStore.get();
  if (!seen[team]) seenStore.set({ seen: { ...seen, [team]: true } });
}

/** False on the server and until the device value is read; then whatever the device remembers. */
export function useResultsSeen(team: string | null): boolean {
  const { seen } = useStore(seenStore);
  useEffect(() => {
    if (!team || team in seenStore.get().seen) return;
    seenStore.set({ seen: { ...seenStore.get().seen, [team]: readResultsSeen(localStorageOrNull(), team) } });
  }, [team]);
  return team ? seen[team] === true : false;
}
