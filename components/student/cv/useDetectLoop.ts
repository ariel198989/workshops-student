'use client';
import { useEffect, useRef, useState, type RefObject } from 'react';
import { videoReady } from '@/lib/cv/camera';
import { containRect, type Rect } from '@/lib/cv/geometry';
import type { Engine } from '@/lib/cv/infer';
import type { Decoded } from '@/lib/cv/yolo';
import type { CameraState } from './useCamera';

/** ~4 detections per second: enough to feel live, light enough for a phone GPU. */
export const FRAME_MS = 250;

export interface Frame { result: Decoded; area: Rect }

interface Args {
  engine: Engine;
  videoRef: RefObject<HTMLVideoElement | null>;
  stageRef: RefObject<HTMLDivElement | null>;
  state: CameraState;
  conf: number;
}

/**
 * Runs the engine on the live video while the camera is live. `area` is the CSS-pixel rectangle the
 * frame occupies inside the stage (object-fit: contain), for drawing boxes. Shared by the results
 * screen's live test and the take-home page; nothing here leaves the device.
 */
export function useDetectLoop({ engine, videoRef, stageRef, state, conf }: Args) {
  const [frame, setFrame] = useState<Frame | null>(null);
  const [failed, setFailed] = useState(false);
  const confRef = useRef(conf);
  useEffect(() => { confRef.current = conf; }, [conf]);

  useEffect(() => {
    if (state !== 'live') return;
    let stop = false;
    let timer: ReturnType<typeof setTimeout>;
    const run = async () => {
      const video = videoRef.current;
      const host = stageRef.current;
      const started = performance.now();
      if (videoReady(video) && host) {
        try {
          const result = await engine.detect(video, confRef.current);
          const r = host.getBoundingClientRect();
          if (!stop) setFrame({ result, area: containRect(r.width, r.height, video.videoWidth, video.videoHeight) });
        } catch {
          if (!stop) setFailed(true);
          return;
        }
      }
      if (!stop) timer = setTimeout(() => void run(), Math.max(30, FRAME_MS - (performance.now() - started)));
    };
    void run();
    return () => { stop = true; clearTimeout(timer); };
  }, [state, engine, videoRef, stageRef]);

  return { frame, failed };
}
