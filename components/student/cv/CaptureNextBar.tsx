'use client';
import { useEffect, useRef } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import { ArrowLeft01Icon } from '@hugeicons/core-free-icons';
import { toast } from '@/lib/store';
import type { CaptureNext } from '@/lib/student/flow';
import c from './camera.module.css';

interface Props {
  next: CaptureNext;
  /** the server count has arrived, so a 'ready' seen now is the state at mount, not a milestone */
  loaded: boolean;
  activeClass: string;
  leaving: boolean;
  onNext: () => void;
}

/** Fires each milestone toast once per session: the group floor, and each object's first target. */
function useMilestoneToasts(next: CaptureNext, loaded: boolean, activeClass: string) {
  const ready = useRef<boolean | null>(null);
  const classReady = useRef<Record<string, boolean>>({});

  useEffect(() => {
    if (!loaded) return;
    if (ready.current === null) { ready.current = next.ready; return; }
    if (next.ready && !ready.current) toast(next.readyToast, true);
    ready.current = next.ready;
  }, [loaded, next.ready, next.readyToast]);

  useEffect(() => {
    if (!loaded || !activeClass) return;
    const before = classReady.current[activeClass];
    if (before === undefined) { classReady.current = { ...classReady.current, [activeClass]: next.classReady }; return; }
    if (next.classReady && !before) toast(next.classToast, true);
    classReady.current = { ...classReady.current, [activeClass]: next.classReady };
  }, [loaded, activeClass, next.classReady, next.classToast]);
}

/** The persistent "what now" strip above the shutter: how many photos, and the one button that moves on. */
export function CaptureNextBar({ next, loaded, activeClass, leaving, onNext }: Props) {
  useMilestoneToasts(next, loaded, activeClass);
  return (
    <div className={c.nextBar} role="group" aria-label="השלב הבא">
      <span className={c.nextCount}>{next.countLabel}</span>
      <button type="button" className={next.ready ? `${c.nextBtn} ${c.nextBtnOn}` : c.nextBtn} disabled={leaving} onClick={onNext}>
        {leaving ? 'רגע' : next.label}
        <HugeiconsIcon icon={ArrowLeft01Icon} size={18} />
      </button>
    </div>
  );
}
