'use client';
import type { BarColor, MetricViewModel } from '@/lib/student/metric';
import s from './cv.module.css';
import m from './metric.module.css';

const BAR_CLASS: Record<BarColor, string> = { green: m.green, yellow: m.yellow, red: m.red };

/** The model's quality in the band's language: a headline, an optional colour bar, a few plain lines, and in L4 a table. */
export function MetricView({ view }: { view: MetricViewModel }) {
  return (
    <div className={m.root}>
      <div className={m.headline}>{view.headline}</div>
      {view.bar ? (
        <div className={m.track} aria-hidden>
          <i className={`${m.fill} ${BAR_CLASS[view.bar.color]}`} style={{ inlineSize: `${Math.round(view.bar.fill * 100)}%` }} />
        </div>
      ) : null}
      {view.lines.length ? (
        <ul className={m.lines}>
          {view.lines.map((line) => <li key={line} className={s.small}>{line}</li>)}
        </ul>
      ) : null}
      {view.table ? (
        <div className={m.tableWrap}>
          <table className={m.table}>
            <thead>
              <tr>{view.table.columns.map((c) => <th key={c}>{c}</th>)}</tr>
            </thead>
            <tbody>
              {view.table.rows.map((row) => (
                <tr key={row.name}>
                  <th scope="row">{row.name}</th>
                  {row.cells.map((cell, i) => <td key={`${row.name}-${i}`} className="num">{cell}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
