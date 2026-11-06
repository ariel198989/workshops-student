import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dirname, '..');
const BYTES: Record<string, number> = { float32: 4, int32: 4, float16: 2, uint8: 1, int8: 1, bool: 1 };

interface Manifest { weightsManifest: { paths: string[]; weights: { shape: number[]; dtype: string }[] }[]; modelTopology: unknown }

/** Every shard the model.json names is in public/, and together they hold exactly the bytes the manifest declares. */
function checkModel(dir: string): number {
  const abs = join(ROOT, 'public', dir);
  const m = JSON.parse(readFileSync(join(abs, 'model.json'), 'utf8')) as Manifest;
  assert.ok(m.modelTopology, `${dir}: graph topology missing`);
  let expected = 0;
  let actual = 0;
  for (const group of m.weightsManifest) {
    for (const w of group.weights) expected += w.shape.reduce((a, b) => a * b, 1) * (BYTES[w.dtype] ?? NaN);
    for (const p of group.paths) {
      assert.ok(existsSync(join(abs, p)), `${dir}/${p} missing`);
      actual += statSync(join(abs, p)).size;
    }
  }
  assert.equal(actual, expected, `${dir}: shard bytes do not match the manifest`);
  return actual;
}

test('MobileNet v2 (alpha 0.5) weights are self-hosted and complete', () => {
  const size = checkModel('models/mobilenet');
  assert.ok(size > 7_000_000 && size < 17_000_000, `unexpected size ${size}`);
});

test('BlazeFace weights are self-hosted and complete', () => {
  const size = checkModel('models/blazeface');
  assert.ok(size > 300_000 && size < 1_000_000, `unexpected size ${size}`);
});

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) return sources(p);
    return /\.(ts|tsx)$/.test(n) ? [p] : [];
  });
}

test('no runtime model download from tfhub or kaggle in app code', () => {
  for (const f of [...sources(join(ROOT, 'lib')), ...sources(join(ROOT, 'components')), ...sources(join(ROOT, 'app'))]) {
    assert.doesNotMatch(readFileSync(f, 'utf8'), /tfhub\.dev|kaggle\.com|storage\.googleapis\.com\/tfjs-models/, f);
  }
});

test('the loaders point at the self-hosted files', () => {
  assert.match(readFileSync(join(ROOT, 'lib/pocket/engine.ts'), 'utf8'), /'\/models\/mobilenet\/model\.json'/);
  assert.match(readFileSync(join(ROOT, 'lib/cv/face-detector.ts'), 'utf8'), /'\/models\/blazeface\/model\.json'/);
});
