'use client';
import { useEffect, useRef } from 'react';
import { toast } from '../store';

/**
 * Calls `fn` immediately and then every `intervalMs` while `enabled`.
 * Ticks are skipped while document.hidden and resume (with an immediate tick) when the tab is visible again.
 * Never overlaps runs; the interval and listener are cleared on unmount or when `enabled` turns false.
 * A failing `fn` toasts once per failure streak instead of every tick.
 */
export function usePolling(fn: () => void | Promise<void>, intervalMs: number, enabled = true): void {
  const fnRef = useRef(fn);
  useEffect(() => {
    fnRef.current = fn;
  });

  useEffect(() => {
    if (!enabled) return;
    let running = false;
    let failing = false;

    const tick = async () => {
      if (running || document.hidden) return;
      running = true;
      try {
        await fnRef.current();
        failing = false;
      } catch (err) {
        if (!failing) toast(err instanceof Error ? err.message : 'עדכון אוטומטי נכשל');
        failing = true;
      } finally {
        running = false;
      }
    };
    const onVisible = () => {
      if (!document.hidden) void tick();
    };

    void tick();
    const timer = setInterval(() => void tick(), intervalMs);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [intervalMs, enabled]);
}
