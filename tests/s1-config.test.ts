import { test } from 'node:test';
import assert from 'node:assert/strict';
import { consoleUrl } from '../lib/config.ts';

test('console url defaults to the deployed console', () => {
  assert.equal(consoleUrl(undefined), 'https://workshops-os-murex.vercel.app');
  assert.equal(consoleUrl('  '), 'https://workshops-os-murex.vercel.app');
});

test('console url can be overridden by NEXT_PUBLIC_CONSOLE_URL', () => {
  assert.equal(consoleUrl(' https://console.example.test '), 'https://console.example.test');
});
