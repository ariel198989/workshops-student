'use client';
// מצב מדריך: one browser, one projector, four steps. Holds the class list,
// the unlearned frame queue and the saved-per-workshop model.
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useStore } from '@/lib/store';
import {
  addExample, clearExamples, dropClass, engineStore, imageFromDataUrl, preloadEngine, restore, serialize,
} from '@/lib/pocket/engine';
import { canClassify } from '@/lib/pocket/score';
import { clearTrainer, loadTrainer, saveTrainer } from '@/lib/pocket/store';
import { joinHe } from '@/lib/robot/mood';
import { useRobot } from '@/lib/robot/useRobot';
import { ClassesStep } from './ClassesStep';
import { GalleryImport } from './GalleryImport';
import { LightStep } from './LightStep';
import { PixelStep } from './pixels/PixelStep';
import { RobotFace } from './robot/RobotFace';
import { TeachStep, type QueuedFrame } from './TeachStep';
import { TestStep } from './TestStep';
import { VoteStep } from './vote/VoteStep';
import f from './facilitator.module.css';

type Step = 'classes' | 'teach' | 'test' | 'light' | 'vote' | 'pixels';
// tools that need no trained model: always reachable
const TOOL_STEPS: ReadonlySet<Step> = new Set<Step>(['vote', 'pixels']);
const STEPS: { id: Step; label: string }[] = [
  { id: 'classes', label: 'מחלקות' }, { id: 'teach', label: 'מלמדים' }, { id: 'test', label: 'בודקים' }, { id: 'light', label: 'רמזור' },
  { id: 'vote', label: 'הצבעה' }, { id: 'pixels', label: 'פיקסלים' },
];
const DEFAULT_CLASSES = ['כוס', 'נעל'];
const ENGINE_HE = { idle: 'המנוע מחכה', loading: 'המנוע נטען', ready: 'המנוע מוכן', error: 'המנוע לא נטען' } as const;

export function Trainer({ workshopId, title }: { workshopId: string | null; title: string }) {
  const engine = useStore(engineStore);
  const [step, setStep] = useState<Step>('classes');
  const [classes, setClasses] = useState<string[]>(DEFAULT_CLASSES);
  const [active, setActive] = useState(DEFAULT_CLASSES[0]);
  const [queue, setQueue] = useState<QueuedFrame[]>([]);
  const [learning, setLearning] = useState<{ done: number; total: number } | null>(null);
  const [gallery, setGallery] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const robot = useRobot();
  const { say } = robot;
  const stepsRef = useRef<HTMLElement | null>(null);

  // on a phone the step bar scrolls sideways: keep the active chip in view
  useEffect(() => {
    const nav = stepsRef.current;
    if (!nav || nav.scrollWidth <= nav.clientWidth) return;
    nav.querySelector<HTMLElement>('[aria-current="step"]')?.scrollIntoView?.({ block: 'nearest', inline: 'center' });
  }, [step]);

  // רובי's resting face outside the live steps: asleep until the first example is learned
  const hasExamples = Object.values(engine.counts).some((n) => n > 0);
  useEffect(() => {
    if (step === 'classes' || step === 'teach') say(hasExamples ? 'idle' : 'sleep');
  }, [step, hasExamples, say]);

  // saved model for this workshop + background MobileNet download
  useEffect(() => {
    preloadEngine();
    const saved = loadTrainer(workshopId);
    if (!saved) return;
    if (saved.classes.length > 0) { setClasses(saved.classes); setActive(saved.classes[0]); }
    let alive = true;
    restore(saved)
      .then(() => { if (alive) setNote('נטען המודל שנשמר על המכשיר הזה.'); })
      .catch(() => { if (alive) setNote('המודל השמור לא נטען. מתחילים מחדש.'); });
    return () => { alive = false; };
  }, [workshopId]);

  const persist = useCallback((cls: string[]) => {
    if (!saveTrainer(workshopId, serialize(cls))) setNote('אין מקום לשמור את המודל על המכשיר. הוא יעבוד עד שסוגרים את הדף.');
  }, [workshopId]);

  const addClass = (name: string) => {
    const next = [...classes, name];
    setClasses(next);
    if (!active) setActive(name);
    persist(next);
    say('class_added', { className: name });
  };
  const removeClass = (name: string) => {
    const next = classes.filter((c) => c !== name);
    setClasses(next);
    setQueue((q) => q.filter((x) => x.label !== name));
    dropClass(name);
    if (active === name) setActive(next[0] ?? '');
    persist(next);
  };

  const learn = async () => {
    const items = [...queue];
    if (items.length === 0) return;
    setLearning({ done: 0, total: items.length });
    try {
      for (let i = 0; i < items.length; i++) {
        await addExample(await imageFromDataUrl(items[i].durl), items[i].label);
        setLearning({ done: i + 1, total: items.length });
      }
      setQueue([]);
      persist(classes);
      navigator.vibrate?.(150);
      say('learned', { count: items.length, className: joinHe([...new Set(items.map((x) => x.label))]) });
    } catch (e) {
      setNote(e instanceof Error && /[֐-׿]/.test(e.message) ? e.message : 'הלמידה נעצרה. נסו שוב.');
    } finally {
      setLearning(null);
    }
  };

  const imported = (names: string[]) => {
    const next = [...new Set([...classes, ...names])];
    setClasses(next);
    if (!active && next[0]) setActive(next[0]);
    persist(next);
    setGallery(false);
  };

  const wipe = () => {
    if (!window.confirm('למחוק את כל הדוגמאות והמחלקות של הסדנה הזאת מהמכשיר?')) return;
    clearExamples();
    clearTrainer(workshopId);
    setClasses(DEFAULT_CLASSES);
    setActive(DEFAULT_CLASSES[0]);
    setQueue([]);
    setStep('classes');
    setNote(null);
    say('reset');
  };

  const ready = engine.status === 'ready' && canClassify(engine.counts);
  const canLeaveClasses = classes.length >= 2;

  return (
    <div className={f.shell}>
      <header className={f.header}>
        <div className={f.titleRow}>
          <Link href="/facilitator" className={f.back}>סדנה אחרת</Link>
          <span className={f.title}>{title}</span>
          <div className={f.robotHead}>
            <RobotFace size="sm" mood={robot.mood} speaking={robot.speaking} />
            <span className={f.robotLine} role="status" aria-live="polite">{robot.line}</span>
          </div>
          <span className={f.engine} aria-live="polite">
            <i className={`${f.engineDot} ${engine.status === 'ready' ? f.engineOn : engine.status === 'error' ? f.engineErr : ''}`} />
            {ENGINE_HE[engine.status]}
          </span>
        </div>
        <div className={f.stepsRow}>
          <nav ref={stepsRef} className={f.steps} aria-label="שלבים">
            {STEPS.map((s, i) => (
              <button key={s.id} type="button" className={`${f.step} ${step === s.id ? f.stepOn : ''}`} aria-current={step === s.id ? 'step' : undefined}
                disabled={s.id !== 'classes' && !TOOL_STEPS.has(s.id) && !canLeaveClasses} onClick={() => setStep(s.id)}>
                <span className={f.stepNo}>{i + 1}</span>{s.label}
              </button>
            ))}
          </nav>
          <button type="button" className={`${f.voice} ${robot.voiceOn ? f.voiceOn : ''}`} aria-pressed={robot.voiceOn}
            disabled={!robot.voiceSupported} title={robot.voiceSupported ? 'רובי מדבר בקול רם' : 'הדפדפן הזה לא יודע לדבר'}
            onClick={() => robot.setVoiceOn(!robot.voiceOn)}>
            <i className={f.voiceDot} aria-hidden />
            קול
          </button>
        </div>
      </header>

      <main className={f.main}>
        {note ? <p className={f.ok} role="status">{note}</p> : null}
        {step === 'classes' ? (
          <ClassesStep classes={classes} counts={engine.counts} onAdd={addClass} onRemove={removeClass} onNext={() => setStep('teach')} />
        ) : null}
        {step === 'teach' ? (
          <TeachStep classes={classes} counts={engine.counts} queue={queue} active={active} learning={learning} workshopId={workshopId}
            onPick={setActive} onShot={(fr) => { setQueue((q) => [...q, fr]); say('shot'); }} onDropShot={(i) => setQueue((q) => q.filter((_, j) => j !== i))}
            onLearn={() => void learn()} onOpenGallery={() => setGallery(true)} onNext={() => setStep('test')} />
        ) : null}
        {step === 'test' ? <TestStep ready={ready} robot={robot} onNext={() => setStep('light')} /> : null}
        {step === 'light' ? <LightStep classes={classes} ready={ready} robot={robot} /> : null}
        {step === 'vote' ? <VoteStep /> : null}
        {step === 'pixels' ? <PixelStep /> : null}
      </main>

      <footer className={f.footer}>
        <span>הכול נשאר על המכשיר הזה. שום תמונה לא עולה.</span>
        <button type="button" className="danger" onClick={wipe}>מחק הכול</button>
      </footer>
      {gallery && workshopId ? (
        <GalleryImport workshopId={workshopId} classes={classes} onImported={imported} onClose={() => setGallery(false)} />
      ) : null}
    </div>
  );
}
