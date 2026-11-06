import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const read = (p: string) => readFileSync(join(import.meta.dirname, '..', p), 'utf8');

test('the statement page carries the standard, the gaps and the coordinator placeholders as-is', () => {
  const page = read('app/accessibility/page.tsx');
  assert.match(page, /הצהרת נגישות/);
  assert.match(page, /5568/);
  assert.match(page, /WCAG 2\.0 ברמה AA/);
  assert.match(page, /מה עדיין לא נגיש במלואו/);
  for (const ph of ['[תאריך]', '[שם]', '[טלפון]', '[X]']) assert.ok(page.includes(ph), ph);
});

test('every frame reaches it: student shell, sign-in, staff notice and the bare public pages', () => {
  assert.match(read('components/student/shell/StudentShell.tsx'), /<A11yLink \/>/);
  assert.match(read('components/AuthGate.tsx'), /variant === 'student' \? <A11yLink \/>/);
  const frame = read('components/AppFrame.tsx');
  assert.equal((frame.match(/<A11yLink \/>/g) ?? []).length, 2);
});
