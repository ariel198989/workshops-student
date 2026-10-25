'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { hebrewDbError } from './validation';

export interface LoadState<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
  /** refetch without blanking the screen */
  reload: () => void;
}

/** Runs `fn` on mount and whenever `deps` change; stale responses are dropped. */
export function useLoad<T>(fn: () => Promise<T>, deps: readonly unknown[]): LoadState<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);
  const fnRef = useRef(fn);
  fnRef.current = fn;
  const silent = useRef(false);

  useEffect(() => {
    let alive = true;
    if (!silent.current) setLoading(true);
    silent.current = false;
    fnRef.current()
      .then((result) => { if (alive) { setData(result); setError(null); } })
      .catch((err: unknown) => { if (alive) setError(hebrewDbError(err)); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);

  const reload = useCallback(() => {
    silent.current = true;
    setTick((n) => n + 1);
  }, []);
  return { data, error, loading, reload };
}
