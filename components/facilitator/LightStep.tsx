'use client';
// Step 4: "אם רואה X אז ירוק/אדום" and a classroom-sized traffic light that
// follows the live prediction through a 1.5s debounce.
import { useEffect, useRef, useState } from 'react';
import { engineStore, notReadyText } from '@/lib/pocket/engine';
import {
  defaultRules, initialLight, lightStep, ruleTarget, toggleRule, type LightDebounce, type LightRule,
} from '@/lib/pocket/score';
import type { RobotApi } from '@/lib/robot/useRobot';
import { useStore } from '@/lib/store';
import { RobotFace } from './robot/RobotFace';
import { SpeechBubble } from './robot/SpeechBubble';
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

/** Full-screen modal: focus lands on the exit button so a keyboard or screen reader is inside it at once. */
function TrafficLight({ rules, robot, onExit }: { rules: LightRule[]; robot: RobotApi; onExit: () => void }) {
  const cam = useFacilitatorCamera();
  const live = useLivePrediction(cam.videoRef, cam.state === 'live');
  const [light, setLight] = useState<LightDebounce>(initialLight);
  const exitRef = useRef<HTMLButtonElement>(null);
  const target = ruleTarget(rules, live.prediction?.label ?? null, live.prediction?.confidence ?? 0);
  const { say } = robot;

  useEffect(() => { exitRef.current?.focus(); }, []);

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

  // רובי follows the light, not the raw prediction: off = still thinking, a colour = sure of that class
  useEffect(() => {
    say(light.shown === 'off' ? 'thinking' : 'sure', { className: shownClass ?? null });
  }, [light.shown, shownClass, say]);
  useEffect(() => () => say('idle'), [say]);

  return (
    <div className={f.lightScreen} role="dialog" aria-modal="true" aria-label="רמזור">
      <button ref={exitRef} type="button" className={f.exitLight} onClick={onExit}>יציאה</button>
      <div className={f.lightRobot}>
        <RobotFace size="sm" mood={robot.mood} speaking={robot.speaking} gaze={0.5} />
        <SpeechBubble line={robot.line} size="sm" />
      </div>
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

export function LightStep({ classes, ready, robot }: { classes: string[]; ready: boolean; robot: RobotApi }) {
  const engine = useStore(engineStore);
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
      {!ready ? <p className={f.err} role={engine.status === 'error' ? 'alert' : undefined}>{notReadyText(engine.status)}</p> : null}
      <div className={f.actions}>
        <button type="button" className={`primary ${f.bigBtn}`} disabled={!ready} onClick={() => setOpen(true)}>הדלקת הרמזור</button>
      </div>
      {open ? <TrafficLight rules={rules} robot={robot} onExit={() => setOpen(false)} /> : null}
    </>
  );
}
