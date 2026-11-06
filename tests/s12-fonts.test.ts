import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const read = (p: string) => readFileSync(join(import.meta.dirname, '..', p), 'utf8');

test('the layout self-hosts its fonts with next/font, no render-blocking Google Fonts link', () => {
  const layout = read('app/layout.tsx');
  assert.match(layout, /from 'next\/font\/google'/);
  assert.doesNotMatch(layout, /<link[^>]+fonts\.googleapis\.com/);
  assert.match(layout, /variable: '--font-rubik'/);
  assert.match(layout, /variable: '--font-space-grotesk'/);
  assert.match(layout, /display: 'swap'/g);
});

test('the stylesheets read the families through the next/font variables, not by name', () => {
  const css = read('app/globals.css');
  assert.match(css, /--font-num:var\(--font-space-grotesk\)/);
  assert.match(css, /font-family:var\(--font-sans\)/);
  assert.doesNotMatch(css, /"Rubik"|"Space Grotesk"/);
});
