'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { friendlyError } from '@/lib/cv/capture-utils';
import { fetchUntagged, isAlreadyHandled, rejectFrame, restoreFrame, saveBox, type QueueRow } from '@/lib/cv/detections';
import type { NBox } from '@/lib/cv/geometry';
import { reloadStudentContext } from '@/lib/student/context';
import { toast, toastWithAction } from '@/lib/store';

const REFRESH_CONTEXT_EVERY = 5;
/** How long the "אין אובייקט" undo stays on screen. */
export const UNDO_MS = 6000;
const REJECTED_MSG = 'התמונה סומנה: אין אובייקט';
const RESTORED_MSG = 'התמונה חזרה לתור';

const insertAt = <T,>(list: T[], at: number, item: T): T[] => [...list.slice(0, at), item, ...list.slice(at)];

/** The group's untagged frames, one at a time. Skipped frames stay for the next reload. */
export function useTagQueue(team: string, userId: string, includeTeammates: boolean) {
  const [rows, setRows] = useState<QueueRow[] | null>(null);
  const [idx, setIdx] = useState(0);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(0);
  const [skipped, setSkipped] = useState(0);
  const [loadError, setLoadError] = useState('');
  const savedRef = useRef(0);
  const idxRef = useRef(0);
  idxRef.current = idx;

  const load = useCallback(async () => {
    setRows(null);
    setLoadError('');
    try {
      setRows(await fetchUntagged(team, userId, includeTeammates));
      setIdx(0);
      setSkipped(0);
    } catch (e) {
      setLoadError(friendlyError(e, 'לא הצלחנו לטעון את התמונות. בדקו את החיבור.'));
      setRows([]);
    }
  }, [team, userId, includeTeammates]);

  useEffect(() => { void load(); }, [load]);
  // progress counters on the home screen follow the writes
  useEffect(() => () => { if (savedRef.current > 0) void reloadStudentContext(); }, []);

  const cur = rows && idx < rows.length ? rows[idx] : null;
  const advance = () => setIdx((i) => i + 1);

  /** Runs a write for the current photo and moves on. A photo someone else already handled also moves on. */
  async function run(action: () => Promise<void>, onOk?: () => void): Promise<boolean> {
    setBusy(true);
    try {
      await action();
      onOk?.();
      advance();
      navigator.vibrate?.(25);
      return true;
    } catch (e) {
      if (isAlreadyHandled(e)) {
        toast(friendlyError(e), true);
        advance();
        return false;
      }
      toast(friendlyError(e));
      return false;
    } finally {
      setBusy(false);
    }
  }

  const save = (box: NBox, label: string) => cur
    ? run(() => saveBox(cur.id, box, label, cur.class_name), () => {
      savedRef.current += 1;
      setSaved(savedRef.current);
      if (savedRef.current % REFRESH_CONTEXT_EVERY === 0) void reloadStudentContext();
    })
    : Promise.resolve(false);

  /** Undo of "אין אובייקט": the row goes back to 'dataset' on the server and to the front of the queue here. */
  const restore = async (row: QueueRow) => {
    try {
      await restoreFrame(row.id);
      setRows((r) => (r ? insertAt(r, idxRef.current, row) : r));
      toast(RESTORED_MSG, true);
    } catch (e) {
      toast(friendlyError(e));
    }
  };

  const noObject = () => cur
    ? run(() => rejectFrame(cur.id), () => toastWithAction(REJECTED_MSG, { label: 'ביטול', onClick: () => void restore(cur) }, UNDO_MS))
    : Promise.resolve(false);
  const skip = () => { setSkipped((n) => n + 1); advance(); };

  return {
    loading: rows === null, loadError, cur, busy, saved, skipped, reload: load,
    remaining: rows ? Math.max(0, rows.length - idx) : 0, total: rows?.length ?? 0,
    save, noObject, skip,
  };
}
