'use client';
// Submitting a concept check and remembering, on this device only, that a phase was already answered.
// The database stores no participant id; neither does this file.
import { sb } from '../db';
import { lockKey, submitErrorMessage, type CheckPhase } from './concept';

export async function submitConceptCheck(sessionModuleId: string, phase: CheckPhase, answers: Record<string, number>): Promise<void> {
  const { error } = await sb.rpc('ws_submit_concept_check', {
    p_session_module: sessionModuleId, p_phase: phase, p_answers: answers,
  });
  if (error) throw new Error(submitErrorMessage(error));
}

export function isPhaseLocked(sessionModuleId: string, phase: CheckPhase): boolean {
  try {
    return window.localStorage.getItem(lockKey(sessionModuleId, phase)) === '1';
  } catch {
    return false;
  }
}

export function lockPhase(sessionModuleId: string, phase: CheckPhase): void {
  try {
    window.localStorage.setItem(lockKey(sessionModuleId, phase), '1');
  } catch { /* private mode: the server still has the answers, only the local guard is lost */ }
}
