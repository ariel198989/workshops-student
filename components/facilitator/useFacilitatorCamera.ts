'use client';
// Same contract as components/student/cv/useCamera, kept separate so the
// facilitator surface does not depend on files under active student work.
import { useCallback, useEffect, useRef, useState } from 'react';
import { cameraErrorMessage, openRearCamera, stopStream } from '@/lib/cv/camera';

export type CameraState = 'starting' | 'live' | 'error';

/** Rear camera on phones, the only webcam on laptops; tracks always stop on unmount. */
export function useFacilitatorCamera() {
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
        if (disposed || !video) { stopStream(stream); return; }
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

const GRAB_WIDTH = 480;

/** Current frame as a small JPEG data URL (480px wide), or null before the first frame. */
export function grabFrame(video: HTMLVideoElement | null, scratch: HTMLCanvasElement): string | null {
  if (!video || !video.videoWidth || video.readyState < 2) return null;
  const w = Math.min(video.videoWidth, GRAB_WIDTH);
  const h = Math.round((video.videoHeight * w) / video.videoWidth);
  scratch.width = w;
  scratch.height = h;
  const ctx = scratch.getContext('2d');
  if (!ctx) return null;
  ctx.drawImage(video, 0, 0, w, h);
  return scratch.toDataURL('image/jpeg', 0.85);
}
