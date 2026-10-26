'use client';
// A plain countdown for the current agenda item: start / pause / reset, no sound.
// Remaining time is derived from a target timestamp so a throttled tab stays honest.
import { useCallback, useEffect, useRef, useState } from 'react';

const TICK_MS = 250;

export interface Countdown {
  /** Whole seconds left, never negative. */
  remaining: number;
  running: boolean;
  /** True once the clock reached zero and was not reset. */
  over: boolean;
  start: () => void;
  pause: () => void;
  toggle: () => void;
  reset: (seconds: number) => void;
}

export function useCountdown(initialSeconds: number): Countdown {
  const [remaining, setRemaining] = useState(Math.max(0, initialSeconds));
  const [running, setRunning] = useState(false);
  const endAt = useRef<number | null>(null);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      const end = endAt.current;
      if (end === null) return;
      const left = Math.max(0, Math.ceil((end - Date.now()) / 1000));
      setRemaining(left);
      if (left === 0) setRunning(false);
    }, TICK_MS);
    return () => clearInterval(id);
  }, [running]);

  const start = useCallback(() => {
    if (remaining <= 0) return;
    endAt.current = Date.now() + remaining * 1000;
    setRunning(true);
  }, [remaining]);

  const pause = useCallback(() => {
    endAt.current = null;
    setRunning(false);
  }, []);

  const reset = useCallback((seconds: number) => {
    endAt.current = null;
    setRunning(false);
    setRemaining(Math.max(0, Math.floor(seconds)));
  }, []);

  const toggle = useCallback(() => { if (running) pause(); else start(); }, [running, pause, start]);

  return { remaining, running, over: remaining === 0 && !running, start, pause, toggle, reset };
}
