'use client';
import { useEffect, useRef, useState } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import { Cancel01Icon } from '@hugeicons/core-free-icons';
import { videoReady } from '@/lib/cv/camera';
import { containRect, type Rect } from '@/lib/cv/geometry';
import type { Engine } from '@/lib/cv/infer';
import type { Decoded } from '@/lib/cv/yolo';
import { DetectionBoxes } from './DetectionBoxes';
import { useCamera } from './useCamera';
import c from './camera.module.css';

/** ~4 detections per second: enough to feel live, light enough for a phone GPU. */
const FRAME_MS = 250;
const DEFAULT_CONF = 0.3;

interface Frame { result: Decoded; area: Rect }

function summary(result: Decoded | null, classes: string[]): string {
  if (!result) return 'מכוונים את המצלמה לאובייקט';
  const name = (i: number) => classes[i] ?? `אובייקט ${i + 1}`;
  if (result.boxes.length) return result.boxes.map((b) => `${name(b.cls)} ${Math.round(b.score * 100)}%`).join(' · ');
  if (result.top) return `לא זיהיתי כלום. הניחוש הכי קרוב: ${name(result.top.cls)} ${Math.round(result.top.score * 100)}%`;
  return 'לא זיהיתי כלום';
}

/** Full-bleed live camera with the model's boxes drawn on top. */
export function LiveTest({ engine, onClose }: { engine: Engine; onClose: () => void }) {
  const { videoRef, state, error, retry } = useCamera();
  const stage = useRef<HTMLDivElement>(null);
  const [frame, setFrame] = useState<Frame | null>(null);
  const [failed, setFailed] = useState(false);
  const [conf, setConf] = useState(DEFAULT_CONF);
  const confRef = useRef(conf);
  useEffect(() => { confRef.current = conf; }, [conf]);

  useEffect(() => {
    if (state !== 'live') return;
    let stop = false;
    let timer: ReturnType<typeof setTimeout>;
    const run = async () => {
      const video = videoRef.current;
      const host = stage.current;
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
  }, [state, engine, videoRef]);

  return (
    <div className={c.cam}>
      <div ref={stage} className={c.stage}>
        <video ref={videoRef} className={`${c.video} ${c.videoContain}`} playsInline muted />
        {frame ? <DetectionBoxes boxes={frame.result.boxes} classes={engine.classes} area={frame.area} /> : null}
      </div>
      <div className={c.top}>
        <div className={c.topRow}>
          <button type="button" className={c.close} onClick={onClose} aria-label="סגירת הבדיקה">
            <HugeiconsIcon icon={Cancel01Icon} size={22} />
          </button>
          <span className={c.title}>בדיקה חיה</span>
          <span className={c.pill}>{engine.backend === 'webgl' ? 'מהיר' : 'איטי (מעבד)'}</span>
        </div>
      </div>
      {state === 'error' || failed ? (
        <div className={c.err} role="alert">
          <p>{failed ? 'הזיהוי נעצר בגלל תקלה. סגרו ופתחו את הבדיקה שוב.' : error}</p>
          {failed ? null : <button type="button" className="primary" onClick={retry}>ניסיון נוסף</button>}
        </div>
      ) : <div className={c.spacer} />}
      <div className={c.bottom}>
        <div className={c.detail} role="status" aria-live="polite">{summary(frame?.result ?? null, engine.classes)}</div>
        <label className={c.range}>
          רגישות
          <input type="range" min={0.15} max={0.7} step={0.05} value={conf}
            onChange={(e) => setConf(Number(e.target.value))} aria-label="סף ביטחון לזיהוי" />
          <span className="num">{Math.round(conf * 100)}%</span>
        </label>
      </div>
    </div>
  );
}
