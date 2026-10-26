// Template placeholders like {{client}} or {{mega_problem}} arrive verbatim in
// module text; show them as a quiet mark instead of raw braces.
import type { ReactNode } from 'react';
import g from './guide.module.css';

const TOKEN = /\{\{\s*([^}]+?)\s*\}\}/g;

export function Tpl({ text }: { text: string }) {
  const out: ReactNode[] = [];
  let last = 0;
  for (const m of text.matchAll(TOKEN)) {
    const at = m.index ?? 0;
    if (at > last) out.push(text.slice(last, at));
    out.push(<mark key={at} className={g.tpl} dir="auto">{m[1].replace(/_/g, ' ')}</mark>);
    last = at + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return <>{out}</>;
}
