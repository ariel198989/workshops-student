'use client';
// Rear <-> front camera toggle, sitting in a corner of any facilitator stage.
import type { FacilitatorCamera } from './useFacilitatorCamera';
import f from './facilitator.module.css';

export function CameraFlip({ cam }: { cam: Pick<FacilitatorCamera, 'facing' | 'flip' | 'state'> }) {
  const toFront = cam.facing === 'environment';
  return (
    <button type="button" className={f.flip} onClick={cam.flip} disabled={cam.state === 'starting'}
      aria-label={toFront ? 'מעבר למצלמה הקדמית' : 'מעבר למצלמה האחורית'} title={toFront ? 'מצלמה קדמית' : 'מצלמה אחורית'}>
      <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M4 7h3l2-2.5h6L17 7h3v11H4z" />
        <path d="M9.5 13a2.5 2.5 0 0 0 4.3 1.8M14.5 12a2.5 2.5 0 0 0-4.3-1.8" />
        <path d="M14.8 14.8v-1.6h-1.6M9.2 10.2v1.6h1.6" />
      </svg>
    </button>
  );
}
