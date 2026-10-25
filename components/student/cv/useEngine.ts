'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { friendlyError } from '@/lib/cv/capture-utils';
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

  useEffect(() => {
    engine.current = null;
    setStatus('idle');
    setError('');
  }, [path]);
  useEffect(() => () => disposeEngine(), []);

  const ensure = useCallback(async (): Promise<Engine | null> => {
    if (!model) return null;
    if (engine.current) return engine.current;
    setStatus('loading');
    setError('');
    try {
      engine.current = await loadEngine(model);
      setStatus('ready');
      return engine.current;
    } catch (e) {
      setError(friendlyError(e, 'המודל לא נטען. בדקו את החיבור ונסו שוב.'));
      setStatus('error');
      return null;
    }
  }, [model]);

  return { status, error, ensure };
}
