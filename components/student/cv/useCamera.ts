'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { cameraErrorMessage, openRearCamera, stopStream } from '@/lib/cv/camera';

export type CameraState = 'starting' | 'live' | 'error';

/** Opens the rear camera into a <video>; always stops the tracks on unmount. */
export function useCamera() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [state, setState] = useState<CameraState>('starting');
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let disposed = false;
    const video = videoRef.current;
    setState('starting');
    (async () => {
      try {
        stream = await openRearCamera();
        if (disposed || !video) { stopStream(stream); return; } // unmounted while the permission prompt was open
        video.srcObject = stream;
        await video.play();
        setState('live');
      } catch (e) {
        if (disposed) return;
        setError(cameraErrorMessage(e));
        setState('error');
      }
    })();
    return () => {
      disposed = true;
      stopStream(stream);
      if (video) video.srcObject = null;
    };
  }, [attempt]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  return { videoRef, state, error, retry };
}
