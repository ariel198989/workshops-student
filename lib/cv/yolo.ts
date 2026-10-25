// Pure YOLO output decoding (no tfjs): letterbox math, output reshape,
// score threshold, per-class NMS. Ported from Smart City lib/infer.ts.

export interface Box { x: number; y: number; w: number; h: number; cls: number; score: number }

export interface Letterbox { scale: number; padX: number; padY: number; nw: number; nh: number }

export interface Decoded { boxes: Box[]; top: Box | null; lowGuess: boolean }

/** Scale to fit a square S x S input, centered, padded (pad colour 114 is applied by the caller). */
export function letterbox(iw: number, ih: number, size: number): Letterbox {
  const scale = Math.min(size / iw, size / ih);
  const nw = Math.round(iw * scale);
  const nh = Math.round(ih * scale);
  return { scale, nw, nh, padX: Math.floor((size - nw) / 2), padY: Math.floor((size - nh) / 2) };
}

/**
 * Turn a raw model output into one row per anchor: [cx, cy, w, h, ...classScores].
 * Ultralytics exports channel-first [1, 4+nc, N] (N = 8400 at 640); the other
 * layout [N, 4+nc] is accepted too. The smaller of the two dims is the channel count.
 */
export function rowsFromOutput(data: ArrayLike<number>, shape: number[]): number[][] {
  const dims = shape.length > 2 ? shape.slice(-2) : shape;
  const [a, b] = dims;
  const channelFirst = a < b;
  const channels = channelFirst ? a : b;
  const count = channelFirst ? b : a;
  const rows: number[][] = new Array(count);
  for (let n = 0; n < count; n++) {
    const row = new Array<number>(channels);
    for (let c = 0; c < channels; c++) row[c] = channelFirst ? data[c * count + n] : data[n * channels + c];
    rows[n] = row;
  }
  return rows;
}

export function iou(a: Box, b: Box): number {
  const x1 = Math.max(a.x, b.x);
  const y1 = Math.max(a.y, b.y);
  const x2 = Math.min(a.x + a.w, b.x + b.w);
  const y2 = Math.min(a.y + a.h, b.y + b.h);
  const inter = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
  const union = a.w * a.h + b.w * b.h - inter;
  return union > 0 ? inter / union : 0;
}

/** Per-class suppression: a strong box of one object must not erase a neighbour of another. */
export function nms(boxes: Box[], iouThreshold: number): Box[] {
  let rest = [...boxes].sort((p, q) => q.score - p.score);
  const keep: Box[] = [];
  while (rest.length) {
    const best = rest[0];
    keep.push(best);
    rest = rest.slice(1).filter((o) => o.cls !== best.cls || iou(best, o) < iouThreshold);
  }
  return keep;
}

function toBox(row: number[], cls: number, score: number, lb: Letterbox, iw: number, ih: number): Box {
  const [cx, cy, w, h] = row;
  return {
    x: (cx - w / 2 - lb.padX) / lb.scale / iw,
    y: (cy - h / 2 - lb.padY) / lb.scale / ih,
    w: w / lb.scale / iw,
    h: h / lb.scale / ih,
    cls,
    score,
  };
}

export function decodeYolo(
  rows: number[][], lb: Letterbox, iw: number, ih: number, conf = 0.25, iouThreshold = 0.45,
): Decoded {
  const nc = Math.max(0, (rows[0]?.length ?? 4) - 4);
  const hits: Box[] = [];
  let top: Box | null = null;
  for (const row of rows) {
    let best = 0;
    let bestC = 0;
    for (let c = 0; c < nc; c++) {
      if (row[4 + c] > best) { best = row[4 + c]; bestC = c; }
    }
    if (best < conf && top && best <= top.score) continue;
    const box = toBox(row, bestC, best, lb, iw, ih);
    if (!top || best > top.score) top = box;
    if (best >= conf) hits.push(box);
  }
  const boxes = nms(hits, iouThreshold);
  return { boxes, top, lowGuess: boxes.length === 0 };
}
