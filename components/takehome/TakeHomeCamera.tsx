'use client';
// Live camera + the group's model, on the family phone. Frames stay in the <video> and the GPU: no canvas
// is uploaded, no request leaves this component (the privacy line on the page depends on that).
import { useRef } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import { Cancel01Icon } from '@hugeicons/core-free-icons';
import { DetectionBoxes } from '@/components/student/cv/DetectionBoxes';
import { useCamera } from '@/components/student/cv/useCamera';
import { useDetectLoop } from '@/components/student/cv/useDetectLoop';
import type { Engine } from '@/lib/cv/infer';
import { describeGuess, TAKE_HOME_COPY } from '@/lib/takehome/shared-model';
import c from '@/components/student/cv/camera.module.css';
import t from './takehome.module.css';

const CONF = 0.3;

export function TakeHomeCamera({ engine, title, onClose }: { engine: Engine; title: string; onClose: () => void }) {
  const { videoRef, state, error, retry } = useCamera();
  const stage = useRef<HTMLDivElement>(null);
  const { frame, failed } = useDetectLoop({ engine, videoRef, stageRef: stage, state, conf: CONF });

  return (
    <div className={c.cam}>
      <div ref={stage} className={c.stage}>
        <video ref={videoRef} className={`${c.video} ${c.videoContain}`} playsInline muted />
        {frame ? <DetectionBoxes boxes={frame.result.boxes} classes={engine.classes} area={frame.area} /> : null}
      </div>
      <div className={c.top}>
        <div className={c.topRow}>
          <button type="button" className={c.close} onClick={onClose} aria-label="סגירת המצלמה">
            <HugeiconsIcon icon={Cancel01Icon} size={22} />
          </button>
          <span className={c.title}>{title}</span>
        </div>
      </div>
      {state === 'error' || failed ? (
        <div className={c.err} role="alert">
          <p>{failed ? 'הזיהוי נעצר בגלל תקלה. סגרו ופתחו את המצלמה שוב.' : error}</p>
          {failed ? null : <button type="button" className="primary" onClick={retry}>ניסיון נוסף</button>}
        </div>
      ) : <div className={c.spacer} />}
      <div className={c.bottom}>
        <div className={`${c.detail} ${t.guess}`} role="status" aria-live="polite">
          {state === 'starting' ? 'פותחים את המצלמה...' : describeGuess(frame?.result ?? null, engine.classes)}
        </div>
        <p className={t.privacyDark}>{TAKE_HOME_COPY.privacy}</p>
      </div>
    </div>
  );
}
