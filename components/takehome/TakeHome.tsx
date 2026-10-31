'use client';
// /model/<token>: the group's model on a family phone. Public, bare (no shell), read-only.
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import { Camera01Icon } from '@hugeicons/core-free-icons';
import { Spinner } from '@/components/ui/Spinner';
import { friendlyError } from '@/lib/cv/capture-utils';
import type { Engine } from '@/lib/cv/infer';
import { loadEngineFromPath } from '@/lib/cv/model';
import { fetchSharedModel } from '@/lib/takehome/shared-api';
import {
  classCounts, imagesHe, isShareToken, TAKE_HOME_COPY, takeHomeState, type SharedModelInfo, type TakeHomeState,
} from '@/lib/takehome/shared-model';
import { TakeHomeCamera } from './TakeHomeCamera';
import t from './takehome.module.css';

type Load = { kind: 'loading' } | { kind: 'error' } | { kind: 'done'; state: TakeHomeState };
type EngineLoad = { kind: 'idle' } | { kind: 'loading' } | { kind: 'ready'; engine: Engine } | { kind: 'error'; message: string };

const MODEL_FAILED = 'הורדת המודל נכשלה. בדקו את החיבור ונסו שוב.';

function Notice({ title, text, children }: { title: string; text?: string; children?: ReactNode }) {
  return (
    <section className={t.card} aria-live="polite">
      <span className={t.brand}>Corewise</span>
      <h1 className={t.h1}>{title}</h1>
      {text ? <p className={t.lead}>{text}</p> : null}
      {children}
    </section>
  );
}

function ClassList({ model }: { model: SharedModelInfo }) {
  const rows = classCounts(model.classes, model.class_stats);
  if (rows.length === 0) return null;
  return (
    <div className={t.classes}>
      <h2 className={t.h2}>מה המודל למד לזהות</h2>
      <ul className={t.classList}>
        {rows.map((r) => (
          <li key={r.name} className={t.classRow}>
            <span className={t.className}>{r.name}</span>
            {r.images !== null ? <span className={t.classCount}>{imagesHe(r.images)}</span> : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Loads the model zip on demand (after the tap, never on page open) and opens the camera. */
function Ready({ state }: { state: Extract<TakeHomeState, { kind: 'ready' }> }) {
  const { shared, model } = state;
  const [engine, setEngine] = useState<EngineLoad>({ kind: 'idle' });
  const [open, setOpen] = useState(false);

  const start = useCallback(async () => {
    setOpen(true);
    if (engine.kind === 'ready') return;
    setEngine({ kind: 'loading' });
    try {
      setEngine({ kind: 'ready', engine: await loadEngineFromPath(model.zip_path, model.classes) });
    } catch (e) {
      setEngine({ kind: 'error', message: friendlyError(e, MODEL_FAILED) });
      setOpen(false);
    }
  }, [engine.kind, model.zip_path, model.classes]);

  return (
    <section className={t.card}>
      <span className={t.brand}>Corewise</span>
      <h1 className={t.h1}>המודל של {shared.group}</h1>
      <p className={t.lead}>
        {shared.workshop}{shared.organization ? ` · ${shared.organization}` : ''}
      </p>
      <button type="button" className={t.cta} onClick={() => void start()} disabled={engine.kind === 'loading'}>
        <HugeiconsIcon icon={Camera01Icon} size={28} />
        {engine.kind === 'loading' ? 'טוענים את המודל...' : 'הפעלת מצלמה'}
      </button>
      {engine.kind === 'loading' ? <p className={t.small}>בפעם הראשונה זה לוקח כמה שניות.</p> : null}
      {engine.kind === 'error' ? (
        <p className={t.error} role="alert">{engine.message}</p>
      ) : null}
      <ClassList model={model} />
      <p className={t.privacy}>{TAKE_HOME_COPY.privacy}</p>
      {open && engine.kind === 'ready' ? (
        <TakeHomeCamera engine={engine.engine} title={`המודל של ${shared.group}`} onClose={() => setOpen(false)} />
      ) : null}
    </section>
  );
}

export function TakeHome({ token }: { token: string }) {
  const [load, setLoad] = useState<Load>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!isShareToken(token)) { setLoad({ kind: 'done', state: { kind: 'bad-token' } }); return; }
    let alive = true;
    setLoad({ kind: 'loading' });
    fetchSharedModel(token)
      .then((shared) => { if (alive) setLoad({ kind: 'done', state: takeHomeState(token, shared) }); })
      .catch(() => { if (alive) setLoad({ kind: 'error' }); });
    return () => { alive = false; };
  }, [token, attempt]);

  const retry = <button type="button" className={t.btn} onClick={() => setAttempt((n) => n + 1)}>ניסיון נוסף</button>;

  return (
    <main className={t.screen}>
      {load.kind === 'loading' ? <div className={t.spin}><Spinner large /></div> : null}
      {load.kind === 'error' ? <Notice title="לא הצלחנו לטעון" text="בדקו את החיבור לאינטרנט ונסו שוב.">{retry}</Notice> : null}
      {load.kind === 'done' ? <Body state={load.state} /> : null}
      <p className={t.foot}>סדנאות ראייה ממוחשבת של Corewise</p>
    </main>
  );
}

function Body({ state }: { state: TakeHomeState }) {
  switch (state.kind) {
    case 'bad-token': return <Notice title={TAKE_HOME_COPY.badToken} text="בקשו מהמדריך את הקישור או סרקו שוב את הברקוד שבתעודה." />;
    case 'not-found': return <Notice title={TAKE_HOME_COPY.notFound} />;
    case 'not-open': return <Notice title={`המודל של ${state.shared.group}`} text={TAKE_HOME_COPY.notOpen} />;
    case 'no-model': return <Notice title={`המודל של ${state.shared.group}`} text={TAKE_HOME_COPY.noModel} />;
    case 'ready': return <Ready state={state} />;
  }
}
