'use client';
import { useRef, type PointerEvent as ReactPointerEvent } from 'react';
import {
  boxFromPoints, hitTest, isUsableBox, moveBox, oppositeCorner, pointBox, pointToNormalized, type NBox, type Pt,
} from '@/lib/cv/geometry';
import type { TagMode } from '@/lib/student/caps';
import t from './tag.module.css';

type Mode = { kind: 'draw'; start: Pt } | { kind: 'resize'; anchor: Pt } | { kind: 'move'; last: Pt } | null;

interface Props {
  src: string;
  box: NBox | null;
  label: string;
  onChange: (box: NBox | null) => void;
  /** box (L3/L4): draw with a finger. point (L2): one tap proposes a box, big handles adjust it. */
  mode?: Exclude<TagMode, 'none'>;
}

const pct = (n: number) => `${n * 100}%`;
/** 44px handles need a wider hit area than the 22px ones of box mode. */
const POINT_HANDLE_TOLERANCE = 0.09;

/** The photo with one box. Box mode: draw anywhere, drag to move, drag a corner to resize. Point mode: tap once to propose. */
export function TagStage({ src, box, label, onChange, mode = 'box' }: Props) {
  const wrap = useRef<HTMLDivElement>(null);
  const drag = useRef<Mode>(null);
  // pointermove can fire faster than React re-renders: read the box from a ref, not from a stale prop
  const live = useRef<NBox | null>(box);
  live.current = box;
  const emit = (b: NBox | null) => { live.current = b; onChange(b); };
  const point = mode === 'point';

  const rectOf = () => wrap.current?.getBoundingClientRect() ?? null;
  const toPoint = (e: ReactPointerEvent): Pt => {
    const r = rectOf();
    return r ? pointToNormalized(e.clientX, e.clientY, r) : { x: 0, y: 0 };
  };

  function down(e: ReactPointerEvent) {
    e.currentTarget.setPointerCapture(e.pointerId);
    const p = toPoint(e);
    const cur = live.current;
    const hit = cur ? hitTest(cur, p, point ? POINT_HANDLE_TOLERANCE : undefined) : null;
    if (hit === 'move' && cur) drag.current = { kind: 'move', last: p };
    else if (hit && hit !== 'move' && cur) drag.current = { kind: 'resize', anchor: oppositeCorner(cur, hit) };
    else if (point) {
      // a tap outside the proposal replaces it: one proposal at a time
      const r = rectOf();
      emit(r ? pointBox(p, { width: r.width, height: r.height }) : null);
      drag.current = null;
    } else {
      drag.current = { kind: 'draw', start: p };
      emit(null);
    }
  }

  function move(e: ReactPointerEvent) {
    const m = drag.current;
    if (!m) return;
    const p = toPoint(e);
    const cur = live.current;
    if (m.kind === 'draw') emit(boxFromPoints(m.start, p));
    else if (m.kind === 'resize') emit(boxFromPoints(m.anchor, p));
    else if (m.kind === 'move' && cur) {
      emit(moveBox(cur, p.x - m.last.x, p.y - m.last.y));
      drag.current = { kind: 'move', last: p };
    }
  }

  function up() {
    const wasDraw = drag.current?.kind === 'draw';
    drag.current = null;
    if (wasDraw && live.current && !isUsableBox(live.current)) emit(null); // a tap or smudge is not a box
  }

  const handle = point ? `${t.handle} ${t.handleLg}` : t.handle;
  return (
    <div ref={wrap} className={point ? `${t.stage} ${t.stagePoint}` : t.stage}
      onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="" draggable={false} className={t.photo} />
      {box ? (
        <div className={t.box} style={{ left: pct(box.x), top: pct(box.y), width: pct(box.w), height: pct(box.h) }}>
          <span className={t.boxLabel}>{label}</span>
          <i className={`${handle} ${t.nw}`} /><i className={`${handle} ${t.ne}`} />
          <i className={`${handle} ${t.sw}`} /><i className={`${handle} ${t.se}`} />
        </div>
      ) : (
        <div className={t.guide}>{point ? 'הקישו על האובייקט' : 'גררו אצבע סביב האובייקט'}</div>
      )}
    </div>
  );
}
