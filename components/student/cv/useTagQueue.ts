'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { friendlyError } from '@/lib/cv/capture-utils';
import { fetchUntagged, rejectFrame, saveBox, type QueueRow } from '@/lib/cv/detections';
import type { NBox } from '@/lib/cv/geometry';
import { reloadStudentContext } from '@/lib/student/context';
import { toast } from '@/lib/store';

const REFRESH_CONTEXT_EVERY = 5;

/** The group's untagged frames, one at a time. Skipped frames stay for the next reload. */
export function useTagQueue(team: string, userId: string, includeTeammates: boolean) {
  const [rows, setRows] = useState<QueueRow[] | null>(null);
  const [idx, setIdx] = useState(0);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(0);
  const [skipped, setSkipped] = useState(0);
  const [loadError, setLoadError] = useState('');
  const savedRef = useRef(0);

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

  async function run(action: () => Promise<void>, onOk?: () => void): Promise<boolean> {
    setBusy(true);
    try {
      await action();
      onOk?.();
      advance();
      navigator.vibrate?.(25);
      return true;
    } catch (e) {
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

  const noObject = () => cur ? run(() => rejectFrame(cur.id)) : Promise.resolve(false);
  const skip = () => { setSkipped((n) => n + 1); advance(); };

  return {
    loading: rows === null, loadError, cur, busy, saved, skipped, reload: load,
    remaining: rows ? Math.max(0, rows.length - idx) : 0, total: rows?.length ?? 0,
    save, noObject, skip,
  };
}
