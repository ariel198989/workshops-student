'use client';
// Fullscreen for the projector. Uses the Fullscreen API when the browser
// grants it and falls back to a fixed full-window overlay when it refuses
// (iPad Safari, embedded webviews). Escape leaves either mode.
import { useCallback, useEffect, useState } from 'react';

export interface Fullscreen {
  readonly on: boolean;
  /** True when the fallback overlay is in use instead of the real API. */
  readonly fallback: boolean;
  readonly toggle: () => void;
}

export function useFullscreen(target: React.RefObject<HTMLElement | null>): Fullscreen {
  const [native, setNative] = useState(false);
  const [fallback, setFallback] = useState(false);

  useEffect(() => {
    const sync = () => setNative(!!document.fullscreenElement && document.fullscreenElement === target.current);
    document.addEventListener('fullscreenchange', sync);
    return () => document.removeEventListener('fullscreenchange', sync);
  }, [target]);

  useEffect(() => {
    if (!fallback) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setFallback(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [fallback]);

  const toggle = useCallback(() => {
    const el = target.current;
    if (fallback) { setFallback(false); return; }
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => setFallback(false));
      return;
    }
    if (!el) return;
    if (typeof el.requestFullscreen !== 'function') { setFallback(true); return; }
    el.requestFullscreen().catch(() => setFallback(true));
  }, [fallback, target]);

  return { on: native || fallback, fallback, toggle };
}
