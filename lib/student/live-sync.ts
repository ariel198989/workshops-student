'use client';
// Keeps ctx.live fresh: a realtime subscription on the workshop's ws_live_state row, and when the
// channel cannot be established, a 20 s refetch of ws_my_context while the tab is visible.
import { useEffect } from 'react';
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { sb } from '../db';
import { reloadStudentContext, setStudentLive } from './context';
import { normalizeLive } from './live';

export const LIVE_POLL_MS = 20000;
const TABLE = 'ws_live_state';
const FAILED = new Set(['CHANNEL_ERROR', 'TIMED_OUT', 'CLOSED']);

type Row = Record<string, unknown>;

function applyChange(payload: RealtimePostgresChangesPayload<Row>): void {
  if (payload.eventType === 'DELETE') { setStudentLive(null); return; }
  setStudentLive(normalizeLive(payload.new));
}

/** Refetches the whole context every LIVE_POLL_MS while the document is visible. Returns the stop function. */
function startPolling(): () => void {
  let timer: ReturnType<typeof setInterval> | null = null;
  const tick = () => { if (document.visibilityState === 'visible') void reloadStudentContext(); };
  const start = () => { if (!timer) timer = setInterval(tick, LIVE_POLL_MS); };
  const stop = () => { if (timer) { clearInterval(timer); timer = null; } };
  const onVisible = () => { if (document.visibilityState === 'visible') { tick(); start(); } else stop(); };
  document.addEventListener('visibilitychange', onVisible);
  start();
  return () => { stop(); document.removeEventListener('visibilitychange', onVisible); };
}

/**
 * Subscribes to live:<workshopId> for the signed-in participant. The store already holds the initial
 * value from ws_my_context, so this only has to forward changes (and poll when realtime is unavailable).
 */
export function useLiveState(workshopId: string | null): void {
  useEffect(() => {
    if (!workshopId) return;
    let stopPolling: (() => void) | null = null;
    const channel = sb.channel(`live:${workshopId}`)
      .on<Row>('postgres_changes', { event: '*', schema: 'public', table: TABLE, filter: `workshop_id=eq.${workshopId}` }, applyChange)
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          if (!stopPolling) return;
          // back from a failed channel: stop polling and catch whatever changed meanwhile
          stopPolling();
          stopPolling = null;
          void reloadStudentContext();
          return;
        }
        if (FAILED.has(status) && !stopPolling) stopPolling = startPolling();
      });
    return () => {
      if (stopPolling) stopPolling();
      void sb.removeChannel(channel);
    };
  }, [workshopId]);
}
