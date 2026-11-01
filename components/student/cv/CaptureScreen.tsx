'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import { Cancel01Icon, CloudUploadIcon } from '@hugeicons/core-free-icons';
import { coachTip, STUCK_HINT, TARGET_FIRST, TARGET_STRONG, uploadStuck, validateClassName } from '@/lib/cv/capture-utils';
import { toast } from '@/lib/store';
import { poolUser, scopeOf } from '@/lib/student/context';
import { nextAfterCapture } from '@/lib/student/flow';
import { CaptureNextBar } from './CaptureNextBar';
import { ClassPicker } from './ClassPicker';
import { useCamera } from './useCamera';
import { useCapture } from './useCapture';
import type { CvSession } from './CvGate';
import c from './camera.module.css';

const BAR_MAX = TARGET_STRONG + 50;
const LEFT_BEHIND = 'חלק מהתמונות עוד לא עלו. בדקו רשת ונסו שוב';
const UPLOADING_LAST = 'מעלים את התמונות האחרונות...';

function GoalBar({ count }: { count: number }) {
  const pct = Math.min(100, (count / BAR_MAX) * 100);
  const next = count < TARGET_FIRST ? TARGET_FIRST : TARGET_STRONG;
  return (
    <div className={c.goal}>
      <span className="num">{count}</span>
      <div className={c.goalBar} aria-hidden>
        <i style={{ inlineSize: `${pct}%` }} />
        <b style={{ insetInlineStart: `${(TARGET_FIRST / BAR_MAX) * 100}%` }} />
        <b style={{ insetInlineStart: `${(TARGET_STRONG / BAR_MAX) * 100}%` }} />
      </div>
      <span className="num">{count >= TARGET_STRONG ? `${TARGET_STRONG}+` : `יעד ${next}`}</span>
    </div>
  );
}

/** Full-bleed capture: pick the object, shoot singles or a series, watch the per-class goal. */
export function CaptureScreen({ session, presetClass }: { session: CvSession; presetClass: string | null }) {
  const subproblem = session.ctx.subproblem;
  const targets = useMemo(() => subproblem?.target_classes ?? [], [subproblem]);
  // no mission targets: a ?cls= link (from the results screen) seeds the custom object
  const [custom, setCustom] = useState<string[]>(() => {
    const seed = presetClass ? validateClassName(presetClass) : null;
    return targets.length === 0 && seed?.ok ? [seed.name] : [];
  });
  const classes = useMemo(() => [...new Set([...targets, ...custom])], [targets, custom]);
  const [active, setActive] = useState('');
  const [leaving, setLeaving] = useState(false);
  const router = useRouter();
  const { videoRef, state, error, retry, stop } = useCamera();
  const scope = scopeOf(session.ctx);
  const cap = useCapture({ videoRef, team: session.team, userId: session.userId, me: poolUser(scope, session.userId), className: active });
  const next = nextAfterCapture(session.ctx.caps, { total: cap.uploaded, active: active ? cap.countOf(active) : undefined });

  useEffect(() => {
    if (active && classes.includes(active)) return;
    setActive(presetClass && classes.includes(presetClass) ? presetClass : (classes[0] ?? ''));
  }, [classes, active, presetClass]);

  useEffect(() => {
    if (cap.stats.queued === 0) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [cap.stats.queued]);

  const addCustom = (cls: string) => { setCustom((l) => [...l, cls]); setActive(cls); };
  const ready = state === 'live' && !!active && !leaving;

  /** Stop shooting, let the last uploads land, release the camera, move on. Nothing is lost on the way. */
  async function goNext() {
    setLeaving(true);
    cap.setRunning(false);
    const left = await cap.idle();
    if (left > 0) { toast(LEFT_BEHIND); setLeaving(false); return; }
    stop();
    router.push(next.href);
  }
  const leave = (e: React.MouseEvent) => {
    if (cap.stats.queued > 0 && !window.confirm('יש תמונות שעוד לא עלו. אם תצאו הן יאבדו. לצאת בכל זאת?')) e.preventDefault();
  };

  return (
    <div className={c.cam}>
      <video ref={videoRef} className={c.video} playsInline muted />
      {cap.flashAt ? <div key={cap.flashAt} className={c.flash} /> : null}
      <div className={c.top}>
        <div className={c.topRow}>
          <Link href="/" className={c.close} onClick={leave} aria-label="יציאה מהצילום">
            <HugeiconsIcon icon={Cancel01Icon} size={22} />
          </Link>
          <span className={c.title}>{scope.personal ? 'צילום' : 'צילום לקבוצה'}</span>
          {cap.sessionTotal > 0 ? <span className={c.pill}>צולמו עכשיו <span className="num">{cap.sessionTotal}</span></span> : null}
        </div>
        <ClassPicker classes={classes} active={active} counts={cap.countOf} onPick={setActive}
          allowCustom={targets.length === 0} onAdd={addCustom} />
        {active ? <GoalBar count={cap.countOf(active)} /> : null}
      </div>

      {state === 'error' ? (
        <div className={c.err} role="alert">
          <p>{error}</p>
          <button type="button" className="primary" onClick={retry}>ניסיון נוסף</button>
        </div>
      ) : <div className={c.spacer} />}

      <div className={c.bottom}>
        {cap.uploaded > 0 ? (
          <CaptureNextBar next={next} loaded={cap.loaded} activeClass={active} leaving={leaving} onNext={() => void goNext()} />
        ) : null}
        {leaving && cap.stats.queued > 0 ? (
          <div className={c.coach} role="status">{UPLOADING_LAST}</div>
        ) : uploadStuck(cap.stats) ? (
          <div className={`${c.coach} ${c.coachWarn}`} role="alert">{STUCK_HINT}</div>
        ) : cap.issueText ? (
          <div className={`${c.coach} ${c.coachWarn}`} role="status">{cap.issueText}</div>
        ) : ready ? (
          <div className={c.coach} role="status">
            {active ? `${coachTip(cap.countOf(active))}. הזיזו את האובייקט, לא את הטלפון.` : 'בחרו אובייקט לצילום'}
          </div>
        ) : null}
        <div className={c.controls}>
          <div className={c.side}>
            <button type="button" disabled={!ready} aria-pressed={cap.running}
              className={cap.running ? `${c.series} ${c.seriesOn}` : c.series} onClick={() => cap.setRunning(!cap.running)}>
              {cap.running ? <><span className={c.rec} />עצירה</> : 'סדרה'}
            </button>
          </div>
          <button type="button" className={c.shutter} disabled={!ready || cap.running}
            aria-label="צילום תמונה" onClick={() => void cap.shoot()} />
          <div className={`${c.side} ${c.sideEnd}`}>
            {cap.stats.queued > 0 ? (
              <button type="button" className={c.queue} onClick={cap.retryNow}
                aria-label={`${cap.stats.queued} תמונות מחכות להעלאה, לחצו לניסיון נוסף`}>
                <HugeiconsIcon icon={CloudUploadIcon} size={18} />
                <span className="num">{cap.stats.queued}</span>{cap.stats.failing ? ' מחכות' : ''}
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
