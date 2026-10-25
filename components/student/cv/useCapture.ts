'use client';
import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { frameQuality, grabJpeg, holdScreenAwake, videoReady } from '@/lib/cv/camera';
import {
  captureFilename, createRetryQueue, randomSuffix, SERIES_INTERVAL_MS, type QueueStats, type RetryQueue,
} from '@/lib/cv/capture-utils';
import { fetchCaptureCounts } from '@/lib/cv/detections';
import { QUALITY_MESSAGES, type QualityReason } from '@/lib/cv/quality';
import { saveCapture, type CaptureItem } from '@/lib/cv/upload';
import { toast } from '@/lib/store';

const RETRY_EVERY_MS = 10000;
const EMPTY_STATS: QueueStats = { queued: 0, saved: 0, failing: false, dropped: 0 };

interface Args { videoRef: RefObject<HTMLVideoElement | null>; team: string; userId: string; className: string }

/** Single shots, the auto-shoot series, per-class counts and the offline retry queue. */
export function useCapture({ videoRef, team, userId, className }: Args) {
  const [base, setBase] = useState<Record<string, number>>({});
  const [taken, setTaken] = useState<Record<string, number>>({});
  const [running, setRunning] = useState(false);
  const [stats, setStats] = useState<QueueStats>(EMPTY_STATS);
  const [issue, setIssue] = useState<QualityReason | null>(null);
  const [skipped, setSkipped] = useState(0);
  const [flashAt, setFlashAt] = useState(0);
  const queue = useRef<RetryQueue<CaptureItem> | null>(null);
  const scratch = useRef<HTMLCanvasElement | null>(null);
  const classRef = useRef(className);

  useEffect(() => { classRef.current = className; }, [className]);
  useEffect(() => { fetchCaptureCounts(team).then(setBase).catch(() => undefined); }, [team]);

  useEffect(() => {
    const q = createRetryQueue<CaptureItem>(saveCapture, { onChange: setStats });
    queue.current = q;
    const retry = () => void q.retryNow();
    const timer = setInterval(() => { if (q.stats().failing) retry(); }, RETRY_EVERY_MS);
    window.addEventListener('online', retry);
    return () => { clearInterval(timer); window.removeEventListener('online', retry); queue.current = null; };
  }, []);

  /** One frame -> the queue. Resolves false when nothing was taken (camera not ready, or the queue is full). */
  const shoot = useCallback(async (): Promise<boolean> => {
    const video = videoRef.current;
    const q = queue.current;
    if (!q || !videoReady(video)) return false;
    scratch.current ??= document.createElement('canvas');
    const blob = await grabJpeg(video, scratch.current);
    if (!blob) return false;
    const cls = classRef.current;
    const item: CaptureItem = { blob, path: captureFilename(Date.now(), randomSuffix()), className: cls, team, userId };
    if (!q.submit(item)) { toast('יש יותר מדי תמונות שמחכות להעלאה. חכו לחיבור ואז המשיכו.'); return false; }
    setTaken((t) => ({ ...t, [cls]: (t[cls] ?? 0) + 1 }));
    setFlashAt(Date.now());
    navigator.vibrate?.(20);
    return true;
  }, [videoRef, team, userId]);

  const shootRef = useRef(shoot);
  useEffect(() => { shootRef.current = shoot; }, [shoot]);

  useEffect(() => {
    if (!running) return;
    let stop = false;
    let timer: ReturnType<typeof setTimeout>;
    const tick = async () => {
      const video = videoRef.current;
      if (videoReady(video)) {
        const quality = frameQuality(video);
        setIssue(quality.reason);
        if (!quality.ok) setSkipped((n) => n + 1);
        else if (!(await shootRef.current())) { setRunning(false); return; }
      }
      if (!stop) timer = setTimeout(() => void tick(), SERIES_INTERVAL_MS);
    };
    timer = setTimeout(() => void tick(), 0);
    let release: () => void = () => undefined;
    void holdScreenAwake().then((r) => { if (stop) r(); else release = r; });
    return () => { stop = true; clearTimeout(timer); release(); setIssue(null); };
  }, [running, videoRef]);

  const countOf = (cls: string) => (base[cls] ?? 0) + (taken[cls] ?? 0);
  const sessionTotal = Object.values(taken).reduce((a, b) => a + b, 0);
  const issueText = issue ? QUALITY_MESSAGES[issue] : null;

  return {
    shoot, running, setRunning, countOf, sessionTotal, stats, issueText, skipped, flashAt,
    retryNow: () => void queue.current?.retryNow(),
  };
}
