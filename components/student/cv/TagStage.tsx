'use client';
import { useRef, type PointerEvent as ReactPointerEvent } from 'react';
import {
  boxFromPoints, hitTest, isUsableBox, moveBox, oppositeCorner, pointToNormalized, type NBox, type Pt,
} from '@/lib/cv/geometry';
import t from './tag.module.css';

type Mode = { kind: 'draw'; start: Pt } | { kind: 'resize'; anchor: Pt } | { kind: 'move'; last: Pt } | null;

interface Props {
  src: string;
  box: NBox | null;
  label: string;
  onChange: (box: NBox | null) => void;
}

const pct = (n: number) => `${n * 100}%`;

/** The photo with a finger-drawn box. Draw anywhere, drag the box to move it, drag a corner to resize. */
export function TagStage({ src, box, label, onChange }: Props) {
  const wrap = useRef<HTMLDivElement>(null);
  const mode = useRef<Mode>(null);
  // pointermove can fire faster than React re-renders: read the box from a ref, not from a stale prop
  const live = useRef<NBox | null>(box);
  live.current = box;
  const emit = (b: NBox | null) => { live.current = b; onChange(b); };

  const point = (e: ReactPointerEvent): Pt => {
    const r = wrap.current?.getBoundingClientRect();
    return r ? pointToNormalized(e.clientX, e.clientY, r) : { x: 0, y: 0 };
  };

  function down(e: ReactPointerEvent) {
    e.currentTarget.setPointerCapture(e.pointerId);
    const p = point(e);
    const hit = live.current ? hitTest(live.current, p) : null;
    if (hit === 'move') mode.current = { kind: 'move', last: p };
    else if (hit && live.current) mode.current = { kind: 'resize', anchor: oppositeCorner(live.current, hit) };
    else { mode.current = { kind: 'draw', start: p }; emit(null); }
  }

  function move(e: ReactPointerEvent) {
    const m = mode.current;
    if (!m) return;
    const p = point(e);
    const cur = live.current;
    if (m.kind === 'draw') emit(boxFromPoints(m.start, p));
    else if (m.kind === 'resize') emit(boxFromPoints(m.anchor, p));
    else if (m.kind === 'move' && cur) {
      emit(moveBox(cur, p.x - m.last.x, p.y - m.last.y));
      mode.current = { kind: 'move', last: p };
    }
  }

  function up() {
    const wasDraw = mode.current?.kind === 'draw';
    mode.current = null;
    if (wasDraw && live.current && !isUsableBox(live.current)) emit(null); // a tap or smudge is not a box
  }

  return (
    <div ref={wrap} className={t.stage} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="" draggable={false} className={t.photo} />
      {box ? (
        <div className={t.box} style={{ left: pct(box.x), top: pct(box.y), width: pct(box.w), height: pct(box.h) }}>
          <span className={t.boxLabel}>{label}</span>
          <i className={`${t.handle} ${t.nw}`} /><i className={`${t.handle} ${t.ne}`} />
          <i className={`${t.handle} ${t.sw}`} /><i className={`${t.handle} ${t.se}`} />
        </div>
      ) : (
        <div className={t.guide}>גררו אצבע סביב האובייקט</div>
      )}
    </div>
  );
}
