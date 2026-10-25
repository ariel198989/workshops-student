'use client';
import Link from 'next/link';
import { Calendar01Icon, UserGroupIcon } from '@hugeicons/core-free-icons';
import { EmptyState } from '@/components/ui/EmptyState';
import { toast } from '@/lib/store';
import {
  attendanceMap, listAttendance, markAllPresent, markAttendance, setAttendanceTaken,
} from '@/lib/ws/attendance';
import { labelOf } from '@/lib/ws/labels';
import { listParticipants } from '@/lib/ws/participants';
import { listSessions } from '@/lib/ws/workshops';
import { ATTENDANCE_STATUSES, type WsParticipant, type WsSession } from '@/lib/ws/types';
import { AttendanceGrid } from '@/components/ws/p4/AttendanceGrid';
import { LoadGate } from '@/components/ws/p4/LoadGate';
import { markKey, nextAttendanceStatus, type MarkMap } from '@/components/ws/p4/attendance-utils';
import { errorText, useCanEdit, useLoader, useWorkshopId } from '@/components/ws/p4/hooks';
import flow from '@/components/ws/p4/flow.module.css';
import styles from '@/components/ws/p4/people.module.css';

interface Data { sessions: WsSession[]; people: WsParticipant[]; marks: MarkMap }

async function loadAll(id: string): Promise<Data> {
  const [sessions, people, marks] = await Promise.all([listSessions(id), listParticipants(id), listAttendance(id)]);
  return {
    sessions: sessions.filter((s) => s.status !== 'cancelled'),
    people: people.filter((p) => p.status !== 'withdrawn'),
    marks: attendanceMap(marks),
  };
}

export default function AttendancePage() {
  const id = useWorkshopId();
  const canEdit = useCanEdit(id);
  const { data, error, loading, reload, setData } = useLoader(() => loadAll(id), id);

  const setMarks = (next: MarkMap) => setData((cur) => cur && { ...cur, marks: next });
  const setTaken = (sid: string) =>
    setData((cur) => cur && { ...cur, sessions: cur.sessions.map((s) => (s.id === sid ? { ...s, attendance_taken: true } : s)) });

  const cycle = async (sessionId: string, participantId: string) => {
    if (!data) return;
    const key = markKey(sessionId, participantId);
    const status = nextAttendanceStatus(data.marks.get(key));
    const before = data.marks;
    setMarks(new Map(before).set(key, status));
    try {
      await markAttendance({ session_id: sessionId, participant_id: participantId, workshop_id: id, status });
      if (!data.sessions.find((s) => s.id === sessionId)?.attendance_taken) {
        await setAttendanceTaken(sessionId, true);
        setTaken(sessionId);
      }
    } catch (err) {
      setMarks(before);
      toast(errorText(err, 'סימון הנוכחות נכשל'));
    }
  };

  // only unmarked cells: a late/absent already entered must survive the shortcut
  const markAll = async (sessionId: string) => {
    if (!data) return;
    const before = data.marks;
    const todo = data.people.filter((p) => !before.has(markKey(sessionId, p.id))).map((p) => p.id);
    const next = new Map(before);
    todo.forEach((pid) => next.set(markKey(sessionId, pid), 'present'));
    setMarks(next);
    try {
      await markAllPresent(sessionId, id, todo);
      setTaken(sessionId);
    } catch (err) {
      setMarks(before);
      toast(errorText(err, 'הסימון נכשל'));
    }
  };

  const noSessions = !!data && data.sessions.length === 0;
  const noPeople = !!data && data.people.length === 0;
  return (
    <LoadGate loading={loading} error={error} hasData={!!data} onRetry={() => void reload()}>
      {data && noSessions ? (
        <EmptyState icon={Calendar01Icon} title="אין מפגשים עדיין" text="נוכחות נלקחת לפי מפגש. טענו קודם את תוכנית הלימודים."
          actions={<Link href={`/workshops/${id}/sessions`}><button type="button" className="primary">למפגשים</button></Link>} />
      ) : null}
      {data && !noSessions && noPeople ? (
        <EmptyState icon={UserGroupIcon} title="אין משתתפים עדיין" text="הוסיפו שמות או חכו שתלמידים יירשמו באפליקציה."
          actions={<Link href={`/workshops/${id}/participants`}><button type="button" className="primary">למשתתפים</button></Link>} />
      ) : null}
      {data && !noSessions && !noPeople ? (
        <>
          <div className={flow.bar}>
            <h2>נוכחות</h2>
            <span className={flow.stamp}>לחיצה או רווח מחליפים בין נוכח, איחר, נעדר ומוצדק. חיצים מזיזים את המיקוד.</span>
          </div>
          <AttendanceGrid sessions={data.sessions} participants={data.people} marks={data.marks} readOnly={!canEdit}
            onCycle={(s, p) => void cycle(s, p)} onMarkAll={(s) => void markAll(s)} />
          <div className={styles.legend}>
            {ATTENDANCE_STATUSES.map((st) => (
              <span key={st}><i className={`${styles.swatch} ${styles[`s_${st}`]}`} />{labelOf('attendance', st)}</span>
            ))}
          </div>
        </>
      ) : null}
    </LoadGate>
  );
}
