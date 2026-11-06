'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { friendlyError } from '@/lib/cv/capture-utils';
import { isStaleLoad } from '@/lib/cv/engine-slot';
import type { Engine } from '@/lib/cv/infer';
import { disposeEngine, loadEngine, type TeamModel } from '@/lib/cv/model';

export type EngineStatus = 'idle' | 'loading' | 'ready' | 'error';

/**
 * Loads the TF.js engine on demand (never on page open). A new zip_path means a
 * newer model: the old engine is dropped and the next test loads the new one.
 */
export function useEngine(model: TeamModel | null) {
  const [status, setStatus] = useState<EngineStatus>('idle');
  const [error, setError] = useState('');
  const engine = useRef<Engine | null>(null);
  const path = model?.zip_path ?? null;
  /** the model this hook currently stands for; a load for any other path is stale on arrival */
  const current = useRef<string | null>(path);

  useEffect(() => {
    current.current = path;
    engine.current = null;
    setStatus('idle');
    setError('');
  }, [path]);
  useEffect(() => () => disposeEngine(), []);

  const ensure = useCallback(async (): Promise<Engine | null> => {
    if (!model) return null;
    if (engine.current) return engine.current;
    const want = model.zip_path;
    setStatus('loading');
    setError('');
    try {
      const loaded = await loadEngine(model);
      if (current.current !== want) return null; // switched to another model meanwhile: drop it
      engine.current = loaded;
      setStatus('ready');
      return loaded;
    } catch (e) {
      if (isStaleLoad(e) || current.current !== want) return null; // the newer load reports for itself
      setError(friendlyError(e, 'המודל לא נטען. בדקו את החיבור ונסו שוב.'));
      setStatus('error');
      return null;
    }
  }, [model]);

  return { status, error, ensure };
}
