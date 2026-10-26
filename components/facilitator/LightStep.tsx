'use client';
// Step 4: "אם רואה X אז ירוק/אדום" and a classroom-sized traffic light that
// follows the live prediction through a 1.5s debounce.
import { useEffect, useState } from 'react';
import {
  defaultRules, initialLight, lightStep, ruleTarget, toggleRule, type LightDebounce, type LightRule,
} from '@/lib/pocket/score';
import { useFacilitatorCamera } from './useFacilitatorCamera';
import { useLivePrediction } from './useLivePrediction';
import f from './facilitator.module.css';

const COLOUR_HE = { green: 'ירוק', red: 'אדום' } as const;

function RuleBuilder({ rules, onToggle }: { rules: LightRule[]; onToggle: (cls: string) => void }) {
  return (
    <div className={f.rules}>
      {rules.map((r) => (
        <div key={r.className} className={f.rule}>
          <span>אם רואה</span>
          <span className={f.ruleClass}>{r.className}</span>
          <span>אז</span>
          <button type="button" className={`${f.ruleBtn} ${r.colour === 'green' ? f.ruleGreen : f.ruleRed}`}
            onClick={() => onToggle(r.className)} aria-label={`${r.className}: ${COLOUR_HE[r.colour]}, לחיצה מחליפה`}>
            {COLOUR_HE[r.colour]}
          </button>
        </div>
      ))}
    </div>
  );
}

function TrafficLight({ rules, onExit }: { rules: LightRule[]; onExit: () => void }) {
  const cam = useFacilitatorCamera();
  const live = useLivePrediction(cam.videoRef, cam.state === 'live');
  const [light, setLight] = useState<LightDebounce>(initialLight);
  const target = ruleTarget(rules, live.prediction?.label ?? null, live.prediction?.confidence ?? 0);

  // the reducer is fed on every prediction and on a timer, so a steady target also fires after 1.5s
  useEffect(() => {
    const feed = () => setLight((s) => lightStep(s, target, Date.now()));
    feed();
    const id = setInterval(feed, 250);
    return () => clearInterval(id);
  }, [target]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onExit(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onExit]);

  const shownClass = rules.find((r) => r.colour === light.shown)?.className;
  return (
    <div className={f.lightScreen} role="dialog" aria-label="רמזור">
      <button type="button" className={f.exitLight} onClick={onExit}>יציאה</button>
      <div className={f.housing} aria-live="polite" aria-label={light.shown === 'off' ? 'כבוי' : COLOUR_HE[light.shown]}>
        <div className={`${f.lamp} ${light.shown === 'red' ? f.lampRed : ''}`} />
        <div className={f.lamp} />
        <div className={`${f.lamp} ${light.shown === 'green' ? f.lampGreen : ''}`} />
      </div>
      <div className={f.lightWord}>{light.shown === 'off' ? 'מחכים' : `${COLOUR_HE[light.shown]}${shownClass ? `, ${shownClass}` : ''}`}</div>
      <div className={f.pip}>
        <video ref={cam.videoRef} className={f.pipVideo} playsInline muted />
      </div>
    </div>
  );
}

export function LightStep({ classes, ready }: { classes: string[]; ready: boolean }) {
  const [rules, setRules] = useState<LightRule[]>(() => defaultRules(classes));
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setRules((prev) => classes.map((c) => prev.find((r) => r.className === c) ?? defaultRules([c])[0]));
  }, [classes]);

  return (
    <>
      <p className={f.lead}>הרמזור מקשיב למודל</p>
      <p className={f.sub}>לחיצה על הצבע מחליפה בין ירוק ואדום. כשהמודל לא בטוח, הרמזור לא משתנה.</p>
      <RuleBuilder rules={rules} onToggle={(cls) => setRules((r) => toggleRule(r, cls))} />
      {!ready ? <p className={f.err}>עוד אין מודל. למדו לפחות שתי מחלקות קודם.</p> : null}
      <div className={f.actions}>
        <button type="button" className={`primary ${f.bigBtn}`} disabled={!ready} onClick={() => setOpen(true)}>הדלקת הרמזור</button>
      </div>
      {open ? <TrafficLight rules={rules} onExit={() => setOpen(false)} /> : null}
    </>
  );
}
