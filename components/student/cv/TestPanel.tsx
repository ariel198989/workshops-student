'use client';
import { useEffect, useState, type ChangeEvent } from 'react';
import { friendlyError } from '@/lib/cv/capture-utils';
import { imageFromFile } from '@/lib/cv/camera';
import type { Engine } from '@/lib/cv/infer';
import type { Decoded } from '@/lib/cv/yolo';
import { DetectionBoxes } from './DetectionBoxes';
import { LiveTest } from './LiveTest';
import type { EngineStatus } from './useEngine';
import s from './cv.module.css';
import r from './results.module.css';

const PHOTO_CONF = 0.25;

interface Props {
  status: EngineStatus;
  error: string;
  ensure: () => Promise<Engine | null>;
}

interface Shot { url: string; result: Decoded; classes: string[] }

function photoSummary(shot: Shot): string {
  const name = (i: number) => shot.classes[i] ?? `אובייקט ${i + 1}`;
  if (shot.result.boxes.length) {
    return `זוהו ${shot.result.boxes.length}: ${shot.result.boxes.map((b) => `${name(b.cls)} ${Math.round(b.score * 100)}%`).join(' · ')}`;
  }
  const top = shot.result.top;
  return top ? `לא זוהה כלום. הניחוש הכי קרוב: ${name(top.cls)} ${Math.round(top.score * 100)}%` : 'לא זוהה כלום';
}

/** The two ways to try the model: live camera, or a single photo (pick or take). */
export function TestPanel({ status, error, ensure }: Props) {
  const [live, setLive] = useState<Engine | null>(null);
  const [shot, setShot] = useState<Shot | null>(null);
  const [problem, setProblem] = useState('');
  const loading = status === 'loading';

  useEffect(() => () => { if (shot) URL.revokeObjectURL(shot.url); }, [shot]);

  async function openLive() {
    setProblem('');
    setLive(await ensure());
  }

  async function onPhoto(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setProblem('');
    try {
      const engine = await ensure();
      if (!engine) return;
      const { img, url } = await imageFromFile(file);
      try {
        setShot({ url, result: await engine.detect(img, PHOTO_CONF), classes: engine.classes });
      } catch (err) {
        URL.revokeObjectURL(url);
        throw err;
      }
    } catch (err) {
      setProblem(friendlyError(err, 'לא הצלחנו לבדוק את התמונה. נסו תמונה אחרת.'));
    }
  }

  return (
    <div className={s.card}>
      <div className={s.cardHead}>בדקו את המודל</div>
      <p className={`${s.small} ${s.lead}`}>הדרך הכי כנה לבדוק: אובייקט אחר מזה שצילמתם, רקע אחר ותאורה אחרת.</p>
      <div className={s.btnRow}>
        <button type="button" className={`${s.btn} ${s.btnPrimary}`} disabled={loading} onClick={() => void openLive()}>
          {loading ? 'טוענים מודל' : 'בדיקה חיה'}
        </button>
        <label className={`${s.btn} ${r.fileBtn}`} aria-disabled={loading}>
          בדיקת תמונה
          <input type="file" accept="image/*" capture="environment" disabled={loading} onChange={(e) => void onPhoto(e)} />
        </label>
      </div>
      {loading ? <p className={`${s.small} ${s.center}`}>בפעם הראשונה הטעינה לוקחת כמה שניות.</p> : null}
      {status === 'error' || problem ? <p className={`${s.note} ${s.noteBad}`} role="alert">{problem || error}</p> : null}
      {shot ? (
        <div className={s.stack} style={{ marginTop: 14 }}>
          <div className={r.photoWrap}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={shot.url} alt="התמונה שנבדקה" className={r.photo} />
            <DetectionBoxes boxes={shot.result.boxes} classes={shot.classes} />
          </div>
          <p className={s.lead} role="status">{photoSummary(shot)}</p>
        </div>
      ) : null}
      {live ? <LiveTest engine={live} onClose={() => setLive(null)} /> : null}
    </div>
  );
}
