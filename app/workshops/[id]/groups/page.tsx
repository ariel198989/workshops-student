'use client';
import { useMemo, useState } from 'react';
import { UserGroupIcon } from '@hugeicons/core-free-icons';
import { EmptyState } from '@/components/ui/EmptyState';
import { ConfirmButton } from '@/components/ws/ConfirmButton';
import { toast } from '@/lib/store';
import { activateGroups, updateGroup } from '@/lib/ws/groups';
import type { GroupPatch } from '@/lib/ws/types';
import { CreateGroupsForm } from '@/components/ws/p4/CreateGroupsForm';
import { DriftBanner } from '@/components/ws/p4/DriftBanner';
import { GroupCard } from '@/components/ws/p4/GroupCard';
import { LoadGate } from '@/components/ws/p4/LoadGate';
import { ProjectorShell } from '@/components/ws/p4/ProjectorShell';
import { UnassignedTray } from '@/components/ws/p4/UnassignedTray';
import { defaultGroupCount, hasInactiveGroups } from '@/components/ws/p4/groups-utils';
import { formatTime } from '@/components/ws/p4/format';
import { errorText, useCanEdit, useWorkshopId } from '@/components/ws/p4/hooks';
import { POLL_MS, useBoard } from '@/components/ws/p4/useBoard';
import styles from '@/components/ws/p4/board.module.css';

export default function GroupsPage() {
  const id = useWorkshopId();
  const canEdit = useCanEdit(id);
  const board = useBoard(id, canEdit);
  const [projector, setProjector] = useState(false);
  const { overview, people } = board;

  const active = useMemo(() => people.filter((p) => p.status === 'active'), [people]);
  const byGroup = useMemo(() => {
    const map = new Map<string, typeof active>();
    for (const p of active) {
      if (p.group_id) map.set(p.group_id, [...(map.get(p.group_id) ?? []), p]);
    }
    return map;
  }, [active]);
  const unassigned = useMemo(() => active.filter((p) => p.group_id === null), [active]);
  const movable = useMemo(() => new Set(active.filter((p) => p.group_id).map((p) => p.id)), [active]);

  const patchGroup = async (groupId: string, patch: GroupPatch) => {
    await updateGroup(groupId, patch);
    void board.refresh();
  };

  const activate = async () => {
    try {
      await activateGroups(id);
      toast('הקבוצות הופעלו באפליקציה', true);
    } catch (err) {
      toast(errorText(err, 'הפעלת הקבוצות נכשלה'));
    }
    await board.refresh();
  };

  const groups = overview?.groups ?? [];
  const isLive = overview?.workshop.status === 'live';
  const stamp = formatTime(overview?.generated_at);
  const count = defaultGroupCount(board.workshop?.audience_size ?? (people.length || null), overview?.workshop.group_size ?? board.workshop?.group_size ?? 4);

  const cards = (big: boolean) => groups.map((g) => (
    <GroupCard key={g.group_id} group={g} members={byGroup.get(g.group_id) ?? []} subproblems={board.subproblems}
      canEdit={canEdit} projector={big} onMove={(pid, gid) => void board.move(pid, gid)} onPatch={patchGroup} />
  ));

  return (
    <LoadGate loading={board.loading} error={board.error} hasData={!!overview} onRetry={() => void board.refresh()}>
      {overview && projector ? (
        <ProjectorShell title={overview.workshop.title} stamp={stamp} onExit={() => setProjector(false)}>
          {cards(true)}
        </ProjectorShell>
      ) : null}

      {overview ? (
        <>
          <div className={styles.bar}>
            <div className={styles.barStart}>
              <h2>קבוצות</h2>
              <span className={styles.stamp}>
                {board.polling ? <><span className={styles.liveDot} aria-hidden="true" />מתעדכן כל {POLL_MS / 1000} שניות</> : 'רענון ידני'}
                {stamp ? ` · עודכן ב-${stamp}` : ''}
              </span>
            </div>
            <div className={styles.barEnd}>
              <button type="button" className="sm" onClick={() => void board.refresh()} disabled={board.refreshing}>רענון</button>
              {groups.length > 0 ? <button type="button" className="sm" onClick={() => setProjector(true)}>מצב מקרן</button> : null}
              {canEdit && isLive && hasInactiveGroups(groups) ? (
                <ConfirmButton label="הפעל קבוצות" confirmText="להפעיל את הקבוצות באפליקציה?" tone="primary" small
                  onConfirm={activate} />
              ) : null}
              {canEdit && groups.length > 0 ? (
                <CreateGroupsForm workshopId={id} defaultCount={count} existing={groups.length} onCreated={() => void board.refresh()} />
              ) : null}
            </div>
          </div>

          <DriftBanner drift={board.drift} canEdit={canEdit} movable={movable} onSync={(pid) => void board.resync(pid)} />

          {groups.length === 0 ? (
            <EmptyState icon={UserGroupIcon} title="עדיין אין קבוצות"
              text={canEdit ? 'בחרו כמה קבוצות ליצור. אפשר להוסיף עוד בכל שלב.' : 'המדריך עדיין לא יצר קבוצות.'}
              actions={canEdit ? <CreateGroupsForm workshopId={id} defaultCount={count} existing={0} onCreated={() => void board.refresh()} /> : undefined} />
          ) : (
            <>
              <UnassignedTray people={unassigned} canEdit={canEdit} onMove={(pid, gid) => void board.move(pid, gid)} />
              <div className={styles.grid}>{cards(false)}</div>
            </>
          )}
        </>
      ) : null}
    </LoadGate>
  );
}
