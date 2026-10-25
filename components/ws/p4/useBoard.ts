'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from '@/lib/store';
import { listParticipants, moveParticipant, reconcile, type ParticipantWithGroup } from '@/lib/ws/participants';
import { usePolling } from '@/lib/ws/poll';
import { fetchOverview, getWorkshop, listSubproblems } from '@/lib/ws/workshops';
import type { DriftEntry, Overview, WsSubproblem, WsWorkshop } from '@/lib/ws/types';
import { applyMove } from './drag';
import { errorText } from './hooks';

export const POLL_MS = 20_000;
// a poll that fires right after a load adds nothing
const FRESH_MS = 5_000;

export interface Board {
  overview: Overview | null;
  workshop: WsWorkshop | null;
  people: ParticipantWithGroup[];
  subproblems: WsSubproblem[];
  drift: DriftEntry[];
  loading: boolean;
  error: string | null;
  refreshing: boolean;
  polling: boolean;
  refresh: () => Promise<void>;
  move: (participantId: string, groupId: string | null) => Promise<void>;
  /** re-applies the participant's current group so the phone's team is rewritten (drift fix) */
  resync: (participantId: string) => Promise<void>;
}

/**
 * State of the live groups board. Loads once, then polls every 20 s only while the workshop is live
 * and the tab is visible (usePolling pauses on document.hidden). Reconcile runs in the same tick for editors.
 */
export function useBoard(workshopId: string, canEdit: boolean): Board {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [workshop, setWorkshop] = useState<WsWorkshop | null>(null);
  const [people, setPeople] = useState<ParticipantWithGroup[]>([]);
  const [subproblems, setSubproblems] = useState<WsSubproblem[]>([]);
  const [drift, setDrift] = useState<DriftEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const loadedAt = useRef(0);
  const peopleRef = useRef(people);
  useEffect(() => {
    peopleRef.current = people;
  });

  const tick = useCallback(async () => {
    if (canEdit) {
      // a failing reconcile must not hide the board
      try {
        const r = await reconcile(workshopId);
        setDrift(r.drift);
        if (r.added > 0) toast(`נוספו ${r.added} משתתפים`, true);
      } catch (err) {
        toast(errorText(err, 'סנכרון המשתתפים נכשל'));
      }
    }
    const [ov, ppl] = await Promise.all([fetchOverview(workshopId), listParticipants(workshopId)]);
    setOverview(ov);
    setPeople(ppl);
    setError(null);
    loadedAt.current = Date.now();
  }, [workshopId, canEdit]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    tick()
      .catch((err) => { if (alive) setError(errorText(err, 'הטעינה נכשלה')); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [tick]);

  useEffect(() => {
    getWorkshop(workshopId).then(setWorkshop).catch(() => setWorkshop(null));
    listSubproblems(workshopId).then(setSubproblems).catch(() => setSubproblems([]));
  }, [workshopId]);

  const polling = overview?.workshop.status === 'live';
  usePolling(async () => {
    if (Date.now() - loadedAt.current < FRESH_MS) return;
    await tick();
  }, POLL_MS, polling);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await tick();
    } catch (err) {
      toast(errorText(err, 'הרענון נכשל'));
    } finally {
      setRefreshing(false);
    }
  }, [tick]);

  const move = useCallback(async (participantId: string, groupId: string | null, force = false) => {
    const before = peopleRef.current;
    if (!force && before.find((p) => p.id === participantId)?.group_id === groupId) return;
    setPeople(applyMove(before, participantId, groupId));
    try {
      await moveParticipant(participantId, groupId);
      setDrift((d) => d.filter((x) => x.participant_id !== participantId));
      fetchOverview(workshopId).then(setOverview).catch(() => undefined);
    } catch (err) {
      setPeople(before);
      toast(errorText(err, 'ההעברה נכשלה'));
    }
  }, [workshopId]);

  const resync = useCallback(async (participantId: string) => {
    const groupId = peopleRef.current.find((p) => p.id === participantId)?.group_id;
    if (groupId) await move(participantId, groupId, true);
  }, [move]);

  return { overview, workshop, people, subproblems, drift, loading, error, refreshing, polling, refresh, move, resync };
}
