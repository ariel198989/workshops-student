'use client';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { Spinner } from '@/components/ui/Spinner';
import { publicUrl } from '@/lib/db';
import { isUsableBox, type NBox } from '@/lib/cv/geometry';
import { TagStage } from './TagStage';
import { useTagQueue } from './useTagQueue';
import type { CvSession } from './CvGate';
import s from './cv.module.css';
import t from './tag.module.css';

function Done({ saved, skipped, onReload }: { saved: number; skipped: number; onReload: () => void }) {
  return (
    <div className={`${s.card} ${s.center} ${s.stack}`}>
      <h2 className={s.h2}>{saved > 0 ? `סיימתם! תויגו ${saved} תמונות` : 'אין תמונות שמחכות לתיוג'}</h2>
      <p className={s.lead}>
        {saved > 0 ? 'התמונות המתויגות נכנסו למאגר של הקבוצה. אפשר לצלם עוד או לעבור לאימון.' : 'צלמו עוד תמונות ואז חזרו לכאן לסמן עליהן תיבות.'}
      </p>
      {skipped > 0 ? (
        <button type="button" className={`${s.btn} ${s.btnWarn}`} onClick={onReload}>חזרה לתמונות שדילגתם ({skipped})</button>
      ) : null}
      <Link href="/capture" className={`${s.btn} ${s.btnPrimary}`}>לצילום</Link>
      <Link href="/train" className={s.btn}>לאימון</Link>
    </div>
  );
}

/** Draw one box per photo, pick which object it is, save. Skipped photos come back on reload. */
export function TagScreen({ session }: { session: CvSession }) {
  const [mates, setMates] = useState(false);
  const q = useTagQueue(session.team, session.userId, mates);
  const [box, setBox] = useState<NBox | null>(null);
  const [lastBox, setLastBox] = useState<NBox | null>(null);
  const [label, setLabel] = useState('');
  const { cur } = q;
  const targets = session.ctx.subproblem?.target_classes;

  useEffect(() => { setBox(null); setLabel(cur?.class_name ?? ''); }, [cur?.id, cur?.class_name]);
  const choices = useMemo(() => [...new Set([...(cur ? [cur.class_name] : []), ...(targets ?? [])])], [cur, targets]);

  async function save(b: NBox | null) {
    if (!b || !isUsableBox(b)) return;
    if (await q.save(b, label || (cur?.class_name ?? ''))) setLastBox(b);
  }

  if (q.loading) return <div className={s.spin}><Spinner large /></div>;
  if (q.loadError) {
    return (
      <div className={`${s.card} ${s.center} ${s.stack}`}>
        <p className={s.lead}>{q.loadError}</p>
        <button type="button" className={`${s.btn} ${s.btnPrimary}`} onClick={() => void q.reload()}>ניסיון נוסף</button>
      </div>
    );
  }
  if (!cur) return <Done saved={q.saved} skipped={q.skipped} onReload={() => void q.reload()} />;

  return (
    <div className={s.stack}>
      <div className={t.progress}>
        <h1 className={s.h2}>נשארו <span className="num">{q.remaining}</span> לתיוג</h1>
        {q.saved > 0 ? <span className={s.chip}>תויגו <span className="num">{q.saved}</span></span> : null}
      </div>
      {choices.length > 1 ? (
        <div className={t.chips} role="radiogroup" aria-label="איזה אובייקט בתמונה">
          {choices.map((c) => (
            <button key={c} type="button" role="radio" aria-checked={c === label}
              className={c === label ? `${t.chipBtn} ${t.chipOn}` : t.chipBtn} onClick={() => setLabel(c)}>{c}</button>
          ))}
        </div>
      ) : null}
      <TagStage src={publicUrl(cur.frame_path)} box={box} label={label || cur.class_name} onChange={setBox} />
      <p className={s.small}>
        תיבה צמודה: הקצוות נוגעים באובייקט, בלי הרבה רקע מסביב. אפשר לגרור את התיבה, או את הפינות שלה.
      </p>
      <div className={t.actions}>
        <button type="button" className={`${s.btn} ${s.btnPrimary} ${t.wide}`} disabled={!box || !isUsableBox(box) || q.busy}
          onClick={() => void save(box)}>{q.busy ? 'שומרים' : 'שמירה והבאה'}</button>
        {lastBox && !box ? (
          <button type="button" className={`${s.btn} ${t.wide}`} disabled={q.busy} onClick={() => void save(lastBox)}>
            אותה תיבה כמו הקודמת
          </button>
        ) : null}
        <button type="button" className={s.btn} disabled={q.busy} onClick={q.skip}>דילוג</button>
        <button type="button" className={`${s.btn} ${s.btnWarn}`} disabled={q.busy} onClick={() => void q.noObject()}>אין אובייקט</button>
      </div>
      <label className={t.toggle}>
        <input type="checkbox" checked={mates} onChange={(e) => setMates(e.target.checked)} />
        להציג גם תמונות של חברי הקבוצה
      </label>
      {mates ? <p className={s.small}>מתייגים גם את התמונות של חברי הקבוצה. כל תיבה עוזרת למודל של כולם.</p> : null}
    </div>
  );
}
