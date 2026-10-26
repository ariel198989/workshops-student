'use client';
// Step 2: tap-tap-tap frames into the selected class, then one "למד" pass.
import { useRef, useState } from 'react';
import { dotStates, RECOMMENDED_PER_CLASS } from '@/lib/pocket/score';
import { grabFrame, useFacilitatorCamera } from './useFacilitatorCamera';
import f from './facilitator.module.css';

export interface QueuedFrame { durl: string; label: string }

interface Props {
  classes: string[];
  counts: Record<string, number>;
  queue: QueuedFrame[];
  active: string;
  learning: { done: number; total: number } | null;
  workshopId: string | null;
  onPick: (cls: string) => void;
  onShot: (frame: QueuedFrame) => void;
  onDropShot: (index: number) => void;
  onLearn: () => void;
  onOpenGallery: () => void;
  onNext: () => void;
}

function ClassCard({ name, learned, queued, on, onPick }: { name: string; learned: number; queued: number; on: boolean; onPick: () => void }) {
  const total = learned + queued;
  return (
    <button type="button" className={`${f.classCard} ${on ? f.classCardOn : ''}`} onClick={onPick} aria-pressed={on}>
      <span className={f.classCardHead}>
        <span>{name}</span>
        <span className={f.count}>{total}</span>
      </span>
      <span className={f.dots} aria-hidden>
        {dotStates(total).map((filled, i) => (
          <i key={i} className={`${f.dot} ${filled ? (i < learned ? f.dotOn : f.dotQueued) : ''}`} />
        ))}
      </span>
    </button>
  );
}

export function TeachStep(p: Props) {
  const cam = useFacilitatorCamera();
  const scratch = useRef<HTMLCanvasElement | null>(null);
  const [flashAt, setFlashAt] = useState(0);

  const shoot = () => {
    if (!p.active) return;
    if (!scratch.current) scratch.current = document.createElement('canvas');
    const durl = grabFrame(cam.videoRef.current, scratch.current);
    if (!durl) return;
    p.onShot({ durl, label: p.active });
    setFlashAt(Date.now());
    navigator.vibrate?.(30);
  };

  const canShoot = cam.state === 'live' && !!p.active && !p.learning;
  const ready = Object.values(p.counts).filter((n) => n > 0).length >= 2;
  const queuedOf = (cls: string) => p.queue.filter((q) => q.label === cls).length;

  return (
    <>
      <div className={f.teachRow}>
        <div className={f.stage}>
          <video ref={cam.videoRef} className={f.video} playsInline muted />
          {flashAt ? <div key={flashAt} className={f.flash} /> : null}
          {cam.state === 'error' ? (
            <div className={f.stageMsg} role="alert">
              <div>
                <p>{cam.error}</p>
                <button type="button" className="primary" onClick={cam.retry}>ניסיון נוסף</button>
              </div>
            </div>
          ) : null}
          {p.learning ? (
            <div className={f.stageMsg} aria-live="polite">
              <div className={f.counter} style={{ background: '#fff', color: 'var(--ink)' }}>
                <span className={f.counterNum}>{p.learning.done}</span>
                <span className={f.counterText}>מתוך {p.learning.total}, המחשב לומד</span>
              </div>
            </div>
          ) : null}
        </div>
        <aside className={f.side}>
          <p className={f.lead}>{p.active ? `מצלמים: ${p.active}` : 'בחרו מחלקה'}</p>
          {p.classes.map((c) => (
            <ClassCard key={c} name={c} learned={p.counts[c] ?? 0} queued={queuedOf(c)} on={c === p.active} onPick={() => p.onPick(c)} />
          ))}
          <p className={f.sub}>{RECOMMENDED_PER_CLASS} תמונות לכל מחלקה, מזוויות שונות.</p>
          {p.workshopId ? (
            <button type="button" onClick={p.onOpenGallery} disabled={!!p.learning}>מהגלריה של הקבוצות</button>
          ) : null}
        </aside>
      </div>

      <div className={f.shutterRow}>
        <button type="button" className={f.shutter} aria-label="צילום תמונה" disabled={!canShoot} onClick={shoot} />
        {p.queue.length > 0 ? (
          <button type="button" className={`primary ${f.learn}`} disabled={!!p.learning} onClick={p.onLearn}>
            למד <span className="num">{p.queue.length}</span>
          </button>
        ) : ready ? (
          <button type="button" className={`primary ${f.learn}`} onClick={p.onNext}>הלאה, בודקים</button>
        ) : null}
      </div>
      {p.queue.length > 0 ? (
        <div className={f.thumbs} aria-label="תמונות שמחכות ללמידה">
          {p.queue.slice(-12).map((q, i) => {
            const index = p.queue.length - Math.min(12, p.queue.length) + i;
            return (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img key={`${index}-${q.durl.length}`} src={q.durl} alt={q.label} title="לחיצה מוחקת" className={f.thumb}
                onClick={() => p.onDropShot(index)} />
            );
          })}
        </div>
      ) : null}
    </>
  );
}
