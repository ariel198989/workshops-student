'use client';
// The student's view of their workshop, one RPC: ws_my_context() returns
// null for anyone who has not joined a workshop yet.
import { useEffect } from 'react';
import { sb } from '../db';
import { createStore, useStore } from '../store';

export interface StudentCoverage { name: string; tagged: number }

export interface StudentProgress {
  photos: number;
  tagged: number;
  untagged: number;
  today: number;
  contributors: number;
  coverage: StudentCoverage[];
  off_target_classes: StudentCoverage[];
  readiness: 'no_targets' | 'red' | 'ok' | 'strong';
  jobs: { pending: number; running: number; done: number; last: { id: string; status: string; image_count: number; created_at: string; completed_at: string | null } | null };
  model: { id: string; name: string; accuracy: number | null; approved: boolean; image_count: number | null; honest_val: boolean | null; class_stats: unknown; personal: boolean; created_at: string } | null;
}

export interface StudentContext {
  workshop: { id: string; title: string; format: string; starts_on: string | null; ends_on: string | null; status: string };
  me: { participant_id: string; full_name: string; roles: string[] };
  group: { id: string; number: number; display_name: string | null; team_name: string } | null;
  teammates: { full_name: string; roles: string[] }[];
  problem: { title: string; statement: string; client_name: string | null } | null;
  subproblem: { title: string; statement: string | null; task_type: string; target_classes: string[]; success_metric: string | null } | null;
  sessions: { session_no: number; title: string; kind: string; scheduled_at: string | null; status: string }[];
  progress: StudentProgress | null;
  certificate: { certificate_no: string; issued_at: string; pdf_path: string | null; status: string } | null;
}

interface State { ctx: StudentContext | null; loading: boolean; loaded: boolean; error: string | null }

export const studentStore = createStore<State>({ ctx: null, loading: false, loaded: false, error: null });

export async function reloadStudentContext(): Promise<StudentContext | null> {
  studentStore.set({ loading: true, error: null });
  const { data, error } = await sb.rpc('ws_my_context');
  if (error) {
    studentStore.set({ loading: false, loaded: true, error: error.message });
    return null;
  }
  const ctx = (data as StudentContext | null) ?? null;
  studentStore.set({ ctx, loading: false, loaded: true });
  return ctx;
}

export function resetStudentContext(): void {
  studentStore.set({ ctx: null, loading: false, loaded: false, error: null });
}

/** Loads once per session; call reloadStudentContext() after a write that changes progress. */
export function useStudentContext(): State & { reload: () => Promise<StudentContext | null> } {
  const state = useStore(studentStore);
  useEffect(() => {
    if (!studentStore.get().loaded && !studentStore.get().loading) void reloadStudentContext();
  }, []);
  return { ...state, reload: reloadStudentContext };
}

/** The data key every photo, job and model of this group carries in Smart City's sc_* tables. */
export const teamOf = (ctx: StudentContext | null): string | null => ctx?.group?.team_name ?? null;
