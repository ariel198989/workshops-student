'use client';
// The facilitator's pocket model: MobileNet v2 (alpha 0.5) embeddings + a kNN
// head, Teachable-Machine style, ported from Smart City's lib/pocket.ts. Runs
// entirely in the browser; nothing is uploaded. Pure rules live in score.ts.
import type * as tfTypes from '@tensorflow/tfjs';
import { createStore } from '../store';
import { canClassify, kFor } from './score';
import { roundVector, type SavedTrainer } from './store';

type Tf = typeof tfTypes;
type Tensor = tfTypes.Tensor;

/** The slice of @tensorflow-models/mobilenet we use. */
interface MobileNetLike {
  infer: (img: tfTypes.Tensor3D | HTMLImageElement | HTMLVideoElement | HTMLCanvasElement, embedding?: boolean) => Tensor;
}

/** The slice of @tensorflow-models/knn-classifier we use. */
interface KnnLike {
  addExample: (example: Tensor, label: string) => void;
  predictClass: (input: Tensor, k?: number) => Promise<{ label: string; classIndex: number; confidences: Record<string, number> }>;
  getClassifierDataset: () => Record<string, tfTypes.Tensor2D>;
  setClassifierDataset: (ds: Record<string, tfTypes.Tensor2D>) => void;
  getClassExampleCount: () => Record<string, number>;
  clearAllClasses: () => void;
}

export type EngineStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface EngineState {
  status: EngineStatus;
  /** Examples the kNN head holds per class label. */
  counts: Record<string, number>;
}

export const engineStore = createStore<EngineState>({ status: 'idle', counts: {} });

export type FrameSource = HTMLImageElement | HTMLVideoElement | HTMLCanvasElement;

export interface Prediction { label: string; confidence: number; confidences: Record<string, number> }

let tf: Tf | null = null;
let net: MobileNetLike | null = null;
let knn: KnnLike | null = null;
let loading: Promise<void> | null = null;

async function load(): Promise<void> {
  engineStore.set({ status: 'loading' });
  try {
    const [tfMod, mobilenet, knnLib] = await Promise.all([
      import('@tensorflow/tfjs'),
      import('@tensorflow-models/mobilenet'),
      import('@tensorflow-models/knn-classifier'),
    ]);
    tf = tfMod;
    await tf.ready();
    if (!net) net = (await mobilenet.load({ version: 2, alpha: 0.5 })) as MobileNetLike; // phone-friendly
    if (!knn) knn = knnLib.create() as KnnLike;
    engineStore.set({ status: 'ready' });
  } catch (e) {
    engineStore.set({ status: 'error' });
    throw e instanceof Error ? e : new Error('המנוע לא נטען');
  }
}

/** Loads MobileNet once; concurrent callers share the same download. */
export function ensureEngine(): Promise<void> {
  if (tf && net && knn) return Promise.resolve();
  if (!loading) loading = load().finally(() => { loading = null; });
  return loading;
}

/** Start downloading while the facilitator is still naming classes. */
export function preloadEngine(): void {
  ensureEngine().catch(() => undefined);
}

const syncCounts = (): void => { engineStore.set({ counts: knn ? { ...knn.getClassExampleCount() } : {} }); };

function embed(src: FrameSource): Tensor {
  if (!tf || !net) throw new Error('המנוע עוד לא מוכן');
  const t = tf; const n = net;
  return t.tidy(() => n.infer(t.browser.fromPixels(src), true));
}

export function imageFromDataUrl(durl: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const im = new Image();
    im.onload = () => res(im);
    im.onerror = () => rej(new Error('התמונה לא נפתחה'));
    im.src = durl;
  });
}

/** Remote (same-project storage) image, CORS-clean so the canvas is not tainted. */
export function imageFromUrl(url: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const im = new Image();
    im.crossOrigin = 'anonymous';
    im.onload = () => res(im);
    im.onerror = () => rej(new Error('התמונה לא נטענה'));
    im.src = url;
  });
}

export async function addExample(src: FrameSource, label: string): Promise<void> {
  await ensureEngine();
  const act = embed(src);
  try { knn!.addExample(act, label); } finally { act.dispose(); }
  syncCounts();
}

/** Null until two classes have examples. k follows the smallest class (see score.ts). */
export async function classify(src: FrameSource): Promise<Prediction | null> {
  await ensureEngine();
  const counts = knn!.getClassExampleCount();
  if (!canClassify(counts)) return null;
  const act = embed(src);
  try {
    const r = await knn!.predictClass(act, kFor(counts));
    return { label: r.label, confidence: r.confidences[r.label] ?? 0, confidences: { ...r.confidences } };
  } finally { act.dispose(); }
}

/** Tensors -> rounded plain arrays, ready for store.ts. */
export function serialize(classes: readonly string[]): SavedTrainer {
  const dataset: SavedTrainer['dataset'] = {};
  if (knn) {
    for (const [label, t] of Object.entries(knn.getClassifierDataset())) {
      dataset[label] = { data: roundVector(t.dataSync()), shape: [t.shape[0], t.shape[1]] };
    }
  }
  return { classes: [...classes], dataset, savedAt: Date.now() };
}

/** Replaces whatever the head holds with a saved dataset. */
export async function restore(saved: SavedTrainer): Promise<void> {
  await ensureEngine();
  const t = tf!;
  const ds: Record<string, tfTypes.Tensor2D> = {};
  for (const [label, c] of Object.entries(saved.dataset)) {
    if (c.shape[0] > 0) ds[label] = t.tensor2d(c.data, c.shape);
  }
  knn!.clearAllClasses();
  if (Object.keys(ds).length > 0) knn!.setClassifierDataset(ds);
  syncCounts();
}

export function clearExamples(): void {
  knn?.clearAllClasses();
  syncCounts();
}

/** Drops one class's examples (the chip was removed) without touching the others. */
export function dropClass(label: string): void {
  if (!knn || !tf) return;
  const ds = knn.getClassifierDataset();
  if (!ds[label]) return;
  const keep: Record<string, tfTypes.Tensor2D> = {};
  for (const [l, t] of Object.entries(ds)) {
    if (l !== label) keep[l] = tf.clone(t) as tfTypes.Tensor2D;
  }
  knn.clearAllClasses();
  if (Object.keys(keep).length > 0) knn.setClassifierDataset(keep);
  syncCounts();
}
