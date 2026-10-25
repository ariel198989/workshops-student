'use client';
import type { CSSProperties } from 'react';
import type { Rect } from '@/lib/cv/geometry';
import type { Box } from '@/lib/cv/yolo';
import r from './results.module.css';

const PALETTE = ['#2DD4BF', '#FBBF24', '#F87171', '#A78BFA', '#60A5FA', '#FB923C', '#34D399', '#F472B6'];

export const classColor = (cls: number): string => PALETTE[Math.abs(cls) % PALETTE.length];

interface Props {
  boxes: Box[];
  classes: string[];
  /** CSS-pixel rectangle the image really occupies (live video, object-fit: contain). Omit when the parent hugs the image. */
  area?: Rect;
}

/** Boxes + "name 87%" labels over an image or video. Coordinates are normalized to the image. */
export function DetectionBoxes({ boxes, classes, area }: Props) {
  const areaStyle: CSSProperties = area
    ? { left: area.left, top: area.top, width: area.width, height: area.height }
    : { inset: 0 };
  return (
    <div className={r.layer} aria-hidden>
      <div className={r.area} style={areaStyle}>
        {boxes.map((b, i) => {
          const x = Math.max(0, b.x);
          const y = Math.max(0, b.y);
          const style = {
            left: `${x * 100}%`, top: `${y * 100}%`,
            width: `${Math.min(1 - x, b.w) * 100}%`, height: `${Math.min(1 - y, b.h) * 100}%`,
            '--c': classColor(b.cls),
          } as CSSProperties;
          return (
            <div key={i} className={r.det} style={style}>
              <span className={y < 0.06 ? `${r.detLabel} ${r.detLabelIn}` : r.detLabel}>
                {classes[b.cls] ?? `אובייקט ${b.cls + 1}`} {Math.round(b.score * 100)}%
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
