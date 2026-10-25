// Pure bounding-box math for the tagger. All coordinates are normalized 0..1
// against the displayed image, which is what sc_detections.bbox stores:
// { x, y, w, h } with (x, y) the top-left corner.

export interface NBox { x: number; y: number; w: number; h: number }
export interface Pt { x: number; y: number }
export type Corner = 'nw' | 'ne' | 'sw' | 'se';
export type Hit = Corner | 'move' | null;

/** A box smaller than this on either side is a finger smudge, not a box. */
export const MIN_BOX = 0.04;
const CORNER_TOLERANCE = 0.06;

export const clamp01 = (n: number): number => (Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0);

export function pointToNormalized(
  clientX: number,
  clientY: number,
  rect: { left: number; top: number; width: number; height: number },
): Pt {
  if (rect.width <= 0 || rect.height <= 0) return { x: 0, y: 0 };
  return {
    x: clamp01((clientX - rect.left) / rect.width),
    y: clamp01((clientY - rect.top) / rect.height),
  };
}

export function boxFromPoints(a: Pt, b: Pt): NBox {
  return { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.abs(a.x - b.x), h: Math.abs(a.y - b.y) };
}

export const isUsableBox = (b: NBox): boolean => b.w >= MIN_BOX && b.h >= MIN_BOX;

/** The corner that stays fixed while `corner` is dragged. Capture it once on pointer-down: after a flip the box no longer says which one it was. */
export function oppositeCorner(box: NBox, corner: Corner): Pt {
  const right = box.x + box.w;
  const bottom = box.y + box.h;
  switch (corner) {
    case 'nw': return { x: right, y: bottom };
    case 'ne': return { x: box.x, y: bottom };
    case 'sw': return { x: right, y: box.y };
    case 'se': return { x: box.x, y: box.y };
  }
}

/** Drag one corner; the opposite corner stays put. Dragging past it flips the box. */
export function resizeBox(box: NBox, corner: Corner, p: Pt): NBox {
  return boxFromPoints(oppositeCorner(box, corner), { x: clamp01(p.x), y: clamp01(p.y) });
}

/** Translate the whole box, keeping it inside the image. */
export function moveBox(box: NBox, dx: number, dy: number): NBox {
  return {
    ...box,
    x: Math.min(1 - box.w, Math.max(0, box.x + dx)),
    y: Math.min(1 - box.h, Math.max(0, box.y + dy)),
  };
}

function near(a: Pt, b: Pt, tol: number): boolean {
  return Math.abs(a.x - b.x) <= tol && Math.abs(a.y - b.y) <= tol;
}

/** What is under the finger: a corner handle, the box body, or nothing. */
export function hitTest(box: NBox, p: Pt, tol = CORNER_TOLERANCE): Hit {
  const corners: [Corner, Pt][] = [
    ['nw', { x: box.x, y: box.y }],
    ['ne', { x: box.x + box.w, y: box.y }],
    ['sw', { x: box.x, y: box.y + box.h }],
    ['se', { x: box.x + box.w, y: box.y + box.h }],
  ];
  for (const [name, pt] of corners) if (near(p, pt, tol)) return name;
  const inside = p.x >= box.x && p.x <= box.x + box.w && p.y >= box.y && p.y <= box.y + box.h;
  return inside ? 'move' : null;
}

/** One YOLO label line: "<class> <xc> <yc> <w> <h>", normalized, center based. */
export function yoloLabelLine(classIndex: number, b: NBox): string {
  const xc = (b.x + b.w / 2).toFixed(6);
  const yc = (b.y + b.h / 2).toFixed(6);
  return `${classIndex} ${xc} ${yc} ${b.w.toFixed(6)} ${b.h.toFixed(6)}`;
}

export interface Rect { left: number; top: number; width: number; height: number }

/** Where an `object-fit: contain` media element really draws inside its container. */
export function containRect(cw: number, ch: number, mw: number, mh: number): Rect {
  if (mw <= 0 || mh <= 0) return { left: 0, top: 0, width: cw, height: ch };
  const k = Math.min(cw / mw, ch / mh);
  const width = mw * k;
  const height = mh * k;
  return { left: (cw - width) / 2, top: (ch - height) / 2, width, height };
}
