'use client';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { Spinner } from '@/components/ui/Spinner';
import { publicUrl } from '@/lib/db';
import { isUsableBox, type NBox } from '@/lib/cv/geometry';
import type { StudentCaps } from '@/lib/student/caps';
import { TagStage } from './TagStage';
import { useTagQueue } from './useTagQueue';
import type { CvSession } from './CvGate';
import s from './cv.module.css';
import t from './tag.module.css';

interface DoneProps { saved: number; skipped: number; caps: StudentCaps; mates: boolean; onMates: () => void; onReload: () => void }

const taggedTitle = (n: number): string => (n === 1 ? 'סיימתם לתייג תמונה אחת' : `סיימתם לתייג ${n} תמונות`);

/** The queue is empty: say what was done and put the next step first. */
function Done({ saved, skipped, caps, mates, onMates, onReload }: DoneProps) {
  return (
    <div className={`${s.card} ${s.center} ${s.stack}`}>
      <h2 className={s.h2}>{saved > 0 ? taggedTitle(saved) : 'אין תמונות שמחכות לתיוג'}</h2>
      <p className={s.lead}>
        {saved > 0 ? 'התמונות המתויגות נכנסו למאגר של הקבוצה.' : 'צלמו עוד תמונות ואז חזרו לכאן לסמן עליהן תיבות.'}
      </p>
      {caps.can_train
        ? <Link href="/train" className={`${s.btn} ${s.btnPrimary}`}>לשלב הבא: אימון</Link>
        : <Link href="/" className={`${s.btn} ${s.btnPrimary}`}>המדריך שולח לאימון</Link>}
      {skipped > 0 ? (
        <button type="button" className={`${s.btn} ${s.btnWarn}`} onClick={onReload}>חזרה לתמונות שדילגתם ({skipped})</button>
      ) : null}
      {!mates ? (
        <button type="button" className={s.btn} onClick={onMates}>עוד תמונות לתייג? כללו גם של חברי הקבוצה</button>
      ) : null}
      {caps.can_capture ? <Link href="/capture" className={`${s.btn} ${s.btnGhost}`}>לצילום</Link> : null}
    </div>
  );
}

interface ActionsProps {
  box: NBox | null;
  lastBox: NBox | null;
  busy: boolean;
  onSave: (b: NBox | null) => void;
  onClear: () => void;
  onSkip: () => void;
  onNoObject: () => void;
}

/** Box mode (L3/L4): save, repeat last box, skip, no object. */
function BoxActions({ box, lastBox, busy, onSave, onSkip, onNoObject }: ActionsProps) {
  return (
    <div className={t.actions}>
      <button type="button" className={`${s.btn} ${s.btnPrimary} ${t.wide}`} disabled={!box || !isUsableBox(box) || busy}
        onClick={() => onSave(box)}>{busy ? 'שומרים' : 'שמירה והבאה'}</button>
      {lastBox && !box ? (
        <button type="button" className={`${s.btn} ${t.wide}`} disabled={busy} onClick={() => onSave(lastBox)}>
          אותה תיבה כמו הקודמת
        </button>
      ) : null}
      <button type="button" className={s.btn} disabled={busy} onClick={onSkip}>דילוג</button>
      <button type="button" className={`${s.btn} ${s.btnWarn}`} disabled={busy} onClick={onNoObject} title="מוחקת את התמונה מהדאטה של הקבוצה">🗑 מחיקת התמונה</button>
    </div>
  );
}

/** Point mode (L2): while a proposal is up, only 'אישור' / 'ביטול'; without one, skip or no object. */
function PointActions({ box, busy, onSave, onClear, onSkip, onNoObject }: ActionsProps) {
  if (box) {
    return (
      <div className={t.bar}>
        <div className={t.actions}>
          <button type="button" className={`${s.btn} ${s.btnPrimary} ${t.tall}`} disabled={busy} onClick={() => onSave(box)}>
            {busy ? 'שומרים' : 'אישור'}
          </button>
          <button type="button" className={`${s.btn} ${t.tall}`} disabled={busy} onClick={onClear}>ביטול</button>
        </div>
      </div>
    );
  }
  return (
    <div className={t.actions}>
      <button type="button" className={s.btn} disabled={busy} onClick={onSkip}>דילוג</button>
      <button type="button" className={`${s.btn} ${s.btnWarn}`} disabled={busy} onClick={onNoObject} title="מוחקת את התמונה מהדאטה של הקבוצה">🗑 מחיקת התמונה</button>
    </div>
  );
}

/** One box per photo, pick which object it is, save. Skipped photos come back on reload. */
export function TagScreen({ session }: { session: CvSession }) {
  const { caps } = session.ctx;
  const point = caps.tag_mode === 'point';
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
  if (!cur) {
    return (
      <Done saved={q.saved} skipped={q.skipped} caps={caps} mates={mates} onMates={() => setMates(true)} onReload={() => void q.reload()} />
    );
  }

  const actions: ActionsProps = {
    box, lastBox, busy: q.busy,
    onSave: (b) => void save(b),
    onClear: () => setBox(null),
    onSkip: q.skip,
    onNoObject: () => void q.noObject(),
  };

  return (
    <div className={s.stack}>
      <div className={t.progress}>
        <h1 className={`${s.h2} ${t.titleRow}`}>
          תיוג
          <span className={`${s.chip} ${s.chipMuted}`} role="status">נותרו <span className="num">{q.remaining}</span></span>
        </h1>
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
      <TagStage src={publicUrl(cur.frame_path)} box={box} label={label || cur.class_name} onChange={setBox}
        mode={point ? 'point' : 'box'} />
      <p className={s.small}>
        {point
          ? 'הקישו על האובייקט ותופיע תיבה. אפשר למשוך את העיגולים כדי שהתיבה תיצמד לאובייקט, ואז לאשר.'
          : 'תיבה צמודה: הקצוות נוגעים באובייקט, בלי הרבה רקע מסביב. אפשר לגרור את התיבה, או את הפינות שלה.'}
      </p>
      {point ? <PointActions {...actions} /> : <BoxActions {...actions} />}
      <label className={t.toggle}>
        <input type="checkbox" checked={mates} onChange={(e) => setMates(e.target.checked)} />
        להציג גם תמונות של חברי הקבוצה
      </label>
      {mates ? <p className={s.small}>מתייגים גם את התמונות של חברי הקבוצה. כל תיבה עוזרת למודל של כולם.</p> : null}
      {point && box ? <div className={t.barSpace} aria-hidden /> : null}
    </div>
  );
}
