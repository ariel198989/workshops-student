'use client';
import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { frameQuality, grabJpeg, holdScreenAwake, videoReady } from '@/lib/cv/camera';
import { createRetryQueue, randomSuffix, SERIES_INTERVAL_MS, type QueueStats, type RetryQueue } from '@/lib/cv/capture-utils';
import { fetchCaptureCounts } from '@/lib/cv/detections';
import { checkFrame, preloadFaceGuard } from '@/lib/cv/face-detector';
import { mayUpload } from '@/lib/cv/face-guard';
import { QUALITY_MESSAGES, type QualityReason } from '@/lib/cv/quality';
import { saveCapture, type CaptureItem } from '@/lib/cv/upload';
import { photoPath, type MediaScope } from '@/lib/cv/ws-data';
import { toast } from '@/lib/store';

const RETRY_EVERY_MS = 10000;
const EMPTY_STATS: QueueStats = { queued: 0, saved: 0, failing: false, dropped: 0, failures: 0 };

interface Args {
  videoRef: RefObject<HTMLVideoElement | null>;
  team: string;
  /** the group's folder in ws-media; every photo path starts with it */
  media: MediaScope;
  userId: string;
  /** whose photos the counts cover: me (personal pool scope) or null for the whole group */
  me: string | null;
  className: string;
}

/** Single shots, the auto-shoot series, per-class counts and the offline retry queue. */
export function useCapture({ videoRef, team, media, userId, me, className }: Args) {
  const { workshopId, groupId } = media;
  const [base, setBase] = useState<Record<string, number>>({});
  const [loaded, setLoaded] = useState(false);
  const [taken, setTaken] = useState<Record<string, number>>({});
  const [running, setRunning] = useState(false);
  const [stats, setStats] = useState<QueueStats>(EMPTY_STATS);
  const [issue, setIssue] = useState<QualityReason | null>(null);
  const [skipped, setSkipped] = useState(0);
  const [flashAt, setFlashAt] = useState(0);
  /** the last shot had a face in it and was not uploaded (privacy guard) */
  const [faceBlocked, setFaceBlocked] = useState(false);
  const busy = useRef(false);
  const queue = useRef<RetryQueue<CaptureItem> | null>(null);
  const scratch = useRef<HTMLCanvasElement | null>(null);
  const classRef = useRef(className);

  useEffect(() => { classRef.current = className; }, [className]);
  useEffect(() => { preloadFaceGuard(); }, []);
  useEffect(() => {
    fetchCaptureCounts(team, me).then(setBase).catch(() => undefined).finally(() => setLoaded(true));
  }, [team, me]);

  useEffect(() => {
    const q = createRetryQueue<CaptureItem>(saveCapture, { onChange: setStats });
    queue.current = q;
    const retry = () => void q.retryNow();
    const timer = setInterval(() => { if (q.stats().failing) retry(); }, RETRY_EVERY_MS);
    window.addEventListener('online', retry);
    return () => { clearInterval(timer); window.removeEventListener('online', retry); queue.current = null; };
  }, []);

  /**
   * One frame -> the face guard -> the queue. Resolves false when nothing was taken: camera not
   * ready, a face in the frame (privacy guard, the photo never leaves the phone), or the queue is full.
   */
  const shoot = useCallback(async (): Promise<boolean> => {
    const video = videoRef.current;
    const q = queue.current;
    if (!q || !videoReady(video) || busy.current) return false;
    busy.current = true; // the scratch canvas holds this frame until the guard has read it
    try {
      scratch.current ??= document.createElement('canvas');
      const blob = await grabJpeg(video, scratch.current);
      if (!blob) return false;
      const faceGuard = await checkFrame(scratch.current);
      if (!mayUpload(faceGuard)) {
        setFaceBlocked(true);
        navigator.vibrate?.([40, 60, 40]);
        return false;
      }
      setFaceBlocked(false);
      const cls = classRef.current;
      // the path is fixed here, at snapshot time: every retry of this item reuses it
      const path = photoPath({ workshopId, groupId }, Date.now(), randomSuffix());
      const item: CaptureItem = { blob, path, className: cls, team, groupId, userId, faceGuard };
      if (!q.submit(item)) { toast('יש יותר מדי תמונות שמחכות להעלאה. חכו לחיבור ואז המשיכו.'); return false; }
      setTaken((t) => ({ ...t, [cls]: (t[cls] ?? 0) + 1 }));
      setFlashAt(Date.now());
      navigator.vibrate?.(20);
      return true;
    } finally {
      busy.current = false;
    }
  }, [videoRef, team, workshopId, groupId, userId]);

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
  /** photos (the group's, or mine in personal scope) really on the server: the count at mount plus this session's finished uploads */
  const uploaded = Object.values(base).reduce((a, b) => a + b, 0) + stats.saved;
  const issueText = issue ? QUALITY_MESSAGES[issue] : null;

  /** Waits for the queue to settle; resolves with how many photos are still waiting (0 when all went up). */
  const idle = async (): Promise<number> => {
    const q = queue.current;
    if (!q) return 0;
    await q.idle();
    return q.stats().queued;
  };

  return {
    shoot, running, setRunning, countOf, sessionTotal, uploaded, loaded, stats, issueText, skipped, flashAt, idle,
    faceBlocked, dismissFace: () => setFaceBlocked(false),
    retryNow: () => void queue.current?.retryNow(),
  };
}
