'use client';
// Classifies the live video every few hundred ms; "frozen" keeps the last
// answer on screen so the class can guess before the reveal.
import { useEffect, useRef, useState } from 'react';
import { classify, type Prediction } from '@/lib/pocket/engine';

const TICK_MS = 350;

export interface LivePrediction {
  prediction: Prediction | null;
  frozen: boolean;
  setFrozen: (f: boolean) => void;
  error: string | null;
}

export function useLivePrediction(video: React.RefObject<HTMLVideoElement | null>, enabled: boolean): LivePrediction {
  const [prediction, setPrediction] = useState<Prediction | null>(null);
  const [frozen, setFrozen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const frozenRef = useRef(frozen);
  frozenRef.current = frozen;

  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const tick = async () => {
      const v = video.current;
      if (!frozenRef.current && v && v.videoWidth > 0 && v.readyState >= 2) {
        try {
          const p = await classify(v);
          if (alive) { setPrediction(p); setError(null); }
        } catch (e) {
          if (alive) setError(e instanceof Error ? e.message : 'הזיהוי נכשל');
        }
      }
      if (alive) timer = setTimeout(() => void tick(), TICK_MS);
    };
    void tick();
    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
    };
  }, [enabled, video]);

  return { prediction, frozen, setFrozen, error };
}
