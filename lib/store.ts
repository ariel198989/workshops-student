'use client';
import { useSyncExternalStore } from 'react';

export interface Store<T> {
  get: () => T;
  set: (patch: Partial<T>) => void;
  subscribe: (fn: () => void) => () => void;
}

export function createStore<T extends object>(initial: T): Store<T> {
  let state = initial;
  const subs = new Set<() => void>();
  return {
    get: () => state,
    set: (patch) => {
      state = { ...state, ...patch };
      subs.forEach((f) => f());
    },
    subscribe: (fn) => {
      subs.add(fn);
      return () => subs.delete(fn);
    },
  };
}

export function useStore<T extends object>(store: Store<T>): T {
  return useSyncExternalStore(store.subscribe, store.get, store.get);
}


// toast bus
export const TOAST_MS = 4000;

export interface ToastAction { label: string; onClick: () => void }

export interface ToastState {
  msg: string;
  info: boolean;
  at: number;
  /** optional button inside the toast (undo); `ms` overrides the default duration */
  action: ToastAction | null;
  ms: number;
}

export const toastStore = createStore<ToastState>({ msg: '', info: false, at: 0, action: null, ms: TOAST_MS });

export const toast = (msg: string, info = false): void =>
  toastStore.set({ msg, info, at: Date.now(), action: null, ms: TOAST_MS });

/** An info toast with one action button that stays up for `ms` (an undo, for example). */
export const toastWithAction = (msg: string, action: ToastAction, ms: number): void =>
  toastStore.set({ msg, info: true, at: Date.now(), action, ms });
