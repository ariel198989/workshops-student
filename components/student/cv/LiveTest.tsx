'use client';
import { useRef, useState } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import { Cancel01Icon } from '@hugeicons/core-free-icons';
import type { Engine } from '@/lib/cv/infer';
import type { Decoded } from '@/lib/cv/yolo';
import { DetectionBoxes } from './DetectionBoxes';
import { useCamera } from './useCamera';
import { useDetectLoop } from './useDetectLoop';
import c from './camera.module.css';

const DEFAULT_CONF = 0.3;

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
  const [conf, setConf] = useState(DEFAULT_CONF);
  const { frame, failed } = useDetectLoop({ engine, videoRef, stageRef: stage, state, conf });

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
