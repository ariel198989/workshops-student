'use client';
// TF.js inference engine (client only). tfjs is imported dynamically, so the
// ~1MB bundle is only fetched on the results screen. Ported from Smart City
// lib/infer.ts; the pure decode lives in ./yolo.
import type { GraphModel, Tensor } from '@tensorflow/tfjs';
import { normalizeHebrewCount } from './capture-utils';
import { decodeYolo, letterbox, rowsFromOutput, type Decoded } from './yolo';

type Tf = typeof import('@tensorflow/tfjs');
export type Source = HTMLVideoElement | HTMLImageElement | HTMLCanvasElement;

export interface Engine {
  classes: string[];
  backend: string;
  detect: (src: Source, conf?: number) => Promise<Decoded>;
  dispose: () => void;
}

const DEFAULT_INPUT = 640;
const PAD_GRAY = 114;
const EMPTY: Decoded = { boxes: [], top: null, lowGuess: true };

// WebGL first; a broken or missing WebGL falls back to the slow-but-alive CPU backend.
let tfReady: Promise<Tf> | null = null;
function loadTf(): Promise<Tf> {
  if (!tfReady) {
    tfReady = (async () => {
      const tf = await import('@tensorflow/tfjs');
      try {
        await tf.setBackend('webgl');
        await tf.ready();
      } catch {
        try { await tf.setBackend('cpu'); await tf.ready(); } catch { /* tfjs keeps its default */ }
      }
      return tf;
    })();
  }
  return tfReady;
}

function parseYamlNames(yaml: string): string[] {
  const m = yaml.match(/names:\s*\[([^\]]*)\]/);
  if (!m) return [];
  return m[1].split(',').map((s) => s.trim().replace(/^['"]|['"]$/g, '')).filter(Boolean);
}

function sourceSize(src: Source): { w: number; h: number } {
  if (src instanceof HTMLVideoElement) return { w: src.videoWidth, h: src.videoHeight };
  if (src instanceof HTMLImageElement) return { w: src.naturalWidth, h: src.naturalHeight };
  return { w: src.width, h: src.height };
}

interface Artifacts { weightsManifest: { paths: string[]; weights: unknown[] }[]; modelTopology: unknown; format?: string; generatedBy?: string; convertedBy?: string }

// tfjs wants a loader; the weights come out of the ZIP as object URLs
function zipLoader(art: Artifacts, urls: Record<string, string>) {
  return {
    load: async () => {
      const weightSpecs: unknown[] = [];
      const paths: string[] = [];
      for (const g of art.weightsManifest) {
        weightSpecs.push(...g.weights);
        for (const p of g.paths) paths.push(urls[p.split('/').pop() ?? p]);
      }
      const buffers = await Promise.all(paths.map((u) => fetch(u).then((r) => r.arrayBuffer())));
      const weightData = new Uint8Array(buffers.reduce((s, b) => s + b.byteLength, 0));
      let off = 0;
      for (const b of buffers) { weightData.set(new Uint8Array(b), off); off += b.byteLength; }
      return {
        modelTopology: art.modelTopology as object, weightSpecs: weightSpecs as never[],
        weightData: weightData.buffer, format: art.format, generatedBy: art.generatedBy, convertedBy: art.convertedBy,
      };
    },
  };
}

export async function createEngine(zipBlob: Blob, fallbackClasses: string[] = []): Promise<Engine> {
  const [tf, JSZip] = await Promise.all([loadTf(), import('jszip').then((m) => m.default)]);
  const zip = await JSZip.loadAsync(zipBlob);
  const names = Object.keys(zip.files).filter((n) => !zip.files[n].dir);
  const urls: Record<string, string> = {};
  for (const n of names) urls[n.split('/').pop() ?? n] = URL.createObjectURL(await zip.files[n].async('blob'));
  try {
    const jsonName = names.find((n) => n.endsWith('model.json'));
    if (!jsonName) throw new Error('בקובץ המודל חסר model.json');
    const art = JSON.parse(await zip.files[jsonName].async('text')) as Artifacts;
    const yamlName = names.find((n) => /(?:^|\/)(metadata|data)\.ya?ml$/i.test(n));
    let classes = yamlName ? parseYamlNames(await zip.files[yamlName].async('text')) : [];
    if (!classes.length) classes = fallbackClasses;
    const model: GraphModel = await tf.loadGraphModel(zipLoader(art, urls));
    return buildEngine(tf, model, classes.map(normalizeHebrewCount));
  } finally {
    Object.values(urls).forEach((u) => URL.revokeObjectURL(u));
  }
}

function buildEngine(tf: Tf, model: GraphModel, classes: string[]): Engine {
  const shape = model.inputs[0].shape ?? [];
  const guess = shape[1] === 3 ? shape[2] : shape[1];
  const size = typeof guess === 'number' && guess > 0 ? guess : DEFAULT_INPUT;
  const scratch = document.createElement('canvas');
  scratch.width = size;
  scratch.height = size;
  const ctx = scratch.getContext('2d', { willReadFrequently: true });

  async function detect(src: Source, conf = 0.25): Promise<Decoded> {
    const { w: iw, h: ih } = sourceSize(src);
    if (!ctx || !iw || !ih) return EMPTY;
    const lb = letterbox(iw, ih, size);
    ctx.fillStyle = `rgb(${PAD_GRAY},${PAD_GRAY},${PAD_GRAY})`;
    ctx.fillRect(0, 0, size, size);
    ctx.drawImage(src, lb.padX, lb.padY, lb.nw, lb.nh);
    const input = tf.tidy(() => tf.browser.fromPixels(scratch).cast('float32').div(255).expandDims(0));
    let outs: Tensor[] = [];
    try {
      const out = model.execute(input);
      outs = Array.isArray(out) ? out : [out];
      const data = await outs[0].data();
      return decodeYolo(rowsFromOutput(data, outs[0].shape), lb, iw, ih, conf);
    } finally {
      input.dispose();
      outs.forEach((t) => t.dispose());
    }
  }

  return { classes, backend: tf.getBackend(), detect, dispose: () => model.dispose() };
}
